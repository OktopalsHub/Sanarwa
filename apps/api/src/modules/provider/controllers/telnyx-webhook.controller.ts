import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../auth/decorators/public.decorator";
import { VoiceService } from "../services/voice.service";
import { WebhookValidatorService } from "../services/webhook-validator.service";

interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_leg_id: string;
      call_session_id: string;
      client_state?: string;
      connection_id: string;
      direction: string;
      from: string;
      to: string;
      state?: string;
      [key: string]: any;
    };
  };
}

@ApiTags("Telnyx Webhooks")
@Controller("webhooks/telnyx")
@Public()
@SkipThrottle()
export class TelnyxWebhookController {
  private readonly logger = new Logger(TelnyxWebhookController.name);

  constructor(
    private readonly voiceService: VoiceService,
    private readonly webhookValidator: WebhookValidatorService,
    private readonly configService: ConfigService,
  ) {}

  @Post("voice")
  @ApiOperation({ summary: "Handle Telnyx voice webhooks" })
  @ApiResponse({ status: 200, description: "Webhook processed successfully" })
  async handleVoiceWebhook(
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() event: TelnyxWebhookEvent,
    @Headers("telnyx-signature-ed25519") signature?: string,
    @Headers("telnyx-timestamp") timestamp?: string,
  ) {
    const rawBody = this.getRawBody(req);
    if (!rawBody) {
      throw new BadRequestException("Missing raw request body for webhook verification");
    }

    const publicKey = this.configService.get<string>("TELNYX_PUBLIC_KEY");
    const verification = this.webhookValidator.verify({
      provider: "telnyx",
      publicKey,
      rawBody,
      headers: {
        "telnyx-signature-ed25519": signature,
        "telnyx-timestamp": timestamp,
      },
    });

    if (verification.kind === "rejected") {
      this.logger.warn(`Rejected Telnyx voice webhook: ${verification.reason}`);
      throw new UnauthorizedException("Invalid Telnyx webhook signature");
    }

    try {
      this.logger.log(
        `Received Telnyx webhook: ${event.data.event_type} for call ${event.data.payload.call_control_id}`,
      );

      const { event_type, payload } = event.data;

      switch (event_type) {
        case "call.initiated":
          await this.handleCallInitiated(payload);
          break;

        case "call.answered":
          await this.handleCallAnswered(payload);
          break;

        case "call.hangup":
          await this.handleCallHangup(payload);
          break;

        case "call.speak.started":
          this.logger.log(`TTS started for call ${payload.call_control_id}`);
          break;

        case "call.speak.ended":
          this.logger.log(`TTS ended for call ${payload.call_control_id}`);
          break;

        default:
          this.logger.log(`Unhandled webhook event: ${event_type}`);
      }

      return { success: true, message: "Webhook processed" };
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);
      throw new HttpException("Failed to process webhook", HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async handleCallInitiated(payload: any) {
    this.logger.log(
      `Call initiated: ${payload.call_control_id} from ${payload.from} to ${payload.to}`,
    );
  }

  private async handleCallAnswered(payload: any) {
    this.logger.log(`Call answered: ${payload.call_control_id}`);

    const customHeaders = payload.custom_headers || [];
    const ttsHeader = customHeaders.find((h: any) => h.name === "X-TTS-Message");

    if (ttsHeader) {
      try {
        const message = Buffer.from(ttsHeader.value, "base64").toString("utf-8");
        this.logger.log(`Playing TTS message for answered call: "${message}"`);

        await this.voiceService.sendTTSToCall(payload.call_control_id, message, {
          voice: "Telnyx.Natural.abbie",
          language: "en-US",
        });
      } catch (error) {
        this.logger.error(`Failed to play TTS message: ${error.message}`);
      }
    }
  }

  private async handleCallHangup(payload: any) {
    this.logger.log(
      `Call ended: ${payload.call_control_id} - ${payload.hangup_cause || "unknown cause"}`,
    );
  }

  private getRawBody(req: Request & { rawBody?: Buffer | string }): string | undefined {
    const raw = req.rawBody;
    if (typeof raw === "string") return raw;
    if (Buffer.isBuffer(raw)) return raw.toString("utf8");
    return undefined;
  }
}
