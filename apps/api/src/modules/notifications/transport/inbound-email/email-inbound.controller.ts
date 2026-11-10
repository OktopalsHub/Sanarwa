import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { NotificationChannel } from "../../../../common/enums/notification-channel.enum";
import { Public } from "../../../auth/decorators/public.decorator";
import { ConsentService } from "../../../preferences/consent.service";
import { NotificationCenterService } from "../../services/notification-center.service";
import { EmailInboundDto } from "./dto/email-inbound.dto";
import { EmailInboundResponseDto } from "./dto/email-inbound.response.dto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

@ApiTags("Notification Transport (Inbound Email)")
@Controller("notifications/inbound")
@Public()
export class EmailInboundController {
  private readonly logger = new Logger(EmailInboundController.name);

  constructor(
    private readonly centerService: NotificationCenterService,
    private readonly consentService: ConsentService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Receive inbound email (signed token)" })
  @ApiResponse({ status: 200, description: "Inbound email processed (received or suppressed)" })
  @ApiResponse({ status: 400, description: "Bad request / token invalid or expired" })
  @ApiResponse({ status: 401, description: "Invalid token signature" })
  @ApiResponse({ status: 503, description: "Inbound email not configured" })
  async receiveEmail(@Body() dto: EmailInboundDto): Promise<EmailInboundResponseDto> {
    // The HMAC secret lives on the server only. A secret echoed in the body
    // would let anyone forge a valid token, so dto.tokenSecret is ignored.
    const secret = this.configService.get<string>("INBOUND_EMAIL_SECRET");
    if (!secret) {
      this.logger.warn("Inbound email received but INBOUND_EMAIL_SECRET is not configured");
      throw new ServiceUnavailableException("Inbound email not configured");
    }

    if (dto.tokenSecret) {
      this.logger.warn("Inbound email request carried a body-supplied tokenSecret; ignored");
    }

    const epochMs = Number(dto.epochMs);
    if (!Number.isFinite(epochMs)) {
      throw new BadRequestException("Invalid token timestamp");
    }
    if (epochMs < Date.now() - TOKEN_TTL_MS) {
      throw new BadRequestException("Token expired");
    }
    if (epochMs > Date.now() + CLOCK_SKEW_MS) {
      throw new BadRequestException("Token timestamp is in the future");
    }

    const tokenMsg = `${dto.tenantId}:${dto.messageId}:${dto.threadId}:${dto.epochMs}`;
    const expected = createHmac("sha256", secret).update(tokenMsg).digest("hex");
    const provided = dto.hmacHex.trim().toLowerCase();
    if (!timingSafeHexEqual(expected, provided)) {
      throw new UnauthorizedException("Invalid token signature");
    }

    const verdict = await this.consentService.checkConsent({
      tenantId: dto.tenantId,
      address: dto.senderAddress,
      subscriberId: dto.senderAddress,
      channel: NotificationChannel.EMAIL,
    });
    if (!verdict.allowed && verdict.reason === "suppressed") {
      await this.consentService.suppress(
        dto.tenantId,
        dto.senderAddress,
        "suppressed",
        NotificationChannel.EMAIL,
      );
      return { status: "suppressed", reason: "address suppressed" };
    }

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + DEFAULT_RETENTION_MS);
    const centerItem = await this.centerService.upsertInboundItem({
      tenantId: dto.tenantId,
      title: dto.subject ?? "Inbound email",
      data: dto.textBody ?? "",
      channel: "email",
      messageId: dto.messageId,
      threadId: dto.threadId,
      expiresAt,
    });

    return {
      status: "received",
      threadId: centerItem.metadata?.threadId,
      messageId: centerItem.messageId,
    };
  }
}

function timingSafeHexEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
