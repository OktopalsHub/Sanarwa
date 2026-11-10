import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBody,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../../auth/decorators/public.decorator";
import { SmsWebhookIntakeService } from "../services/sms-webhook-intake.service";

export interface InboundSMSPayload {
  messageId: string;
  from: string;
  to: string;
  text: string;
  timestamp: Date;
  provider: string;
  metadata?: Record<string, any>;
}

export interface SMSStatusPayload {
  messageId: string;
  status: "delivered" | "failed" | "sent" | "received";
  timestamp: Date;
  provider?: string;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@ApiTags("SMS Webhooks")
@Controller("webhooks/sms")
@Public()
@SkipThrottle()
export class SMSWebhookController {
  constructor(private readonly intake: SmsWebhookIntakeService) {}

  @Post("twilio/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Twilio inbound SMS webhooks (BYOP supported)" })
  async handleTwilioInbound(
    @RawBody() rawBody: Buffer,
    @Body() body: any,
    @Headers("x-twilio-signature") signature?: string,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTwilioInbound(rawBody?.toString("utf8") ?? "", signature, body);
  }

  @Post("twilio/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Twilio SMS status callbacks (BYOP supported)" })
  async handleTwilioStatus(
    @RawBody() rawBody: Buffer,
    @Body() body: any,
    @Headers("x-twilio-signature") signature?: string,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTwilioStatus(rawBody?.toString("utf8") ?? "", signature, body);
  }

  @Post("termii/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Termii inbound SMS webhooks (BYOP)" })
  async handleTermiiInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTermiiInbound(headers, body);
  }

  @Post("termii/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Termii delivery report webhooks (BYOP)" })
  async handleTermiiStatus(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTermiiStatus(headers, body);
  }

  @Post("infobip/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Infobip inbound SMS webhooks (BYOP)" })
  async handleInfobipInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptInfobipInbound(headers, body);
  }

  @Post("infobip/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Infobip delivery report webhooks (BYOP)" })
  async handleInfobipStatus(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptInfobipStatus(headers, body);
  }

  @Post("telnyx/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Telnyx inbound SMS webhooks (managed/global)" })
  async handleTelnyxInbound(
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() body: any,
    @Headers("telnyx-signature-ed25519") signature?: string,
    @Headers("telnyx-timestamp") timestamp?: string,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTelnyx(this.raw(req), { signature, timestamp }, body);
  }

  @Post("telnyx/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Telnyx SMS delivery status webhooks (managed/global)" })
  async handleTelnyxStatus(
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() body: any,
    @Headers("telnyx-signature-ed25519") signature?: string,
    @Headers("telnyx-timestamp") timestamp?: string,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTelnyxStatus(this.raw(req), { signature, timestamp }, body);
  }

  @Post("telnyx/:tenantId/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Telnyx inbound SMS webhooks (BYOP, tenant-scoped)" })
  async handleTelnyxInboundByop(
    @Param("tenantId") tenantId: string,
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() body: any,
    @Headers("telnyx-signature-ed25519") signature?: string,
    @Headers("telnyx-timestamp") timestamp?: string,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTelnyxByTenant(
      this.raw(req),
      { signature, timestamp },
      body,
      tenantId,
    );
  }

  @Post("telnyx/:tenantId/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Telnyx SMS status webhooks (BYOP, tenant-scoped)" })
  async handleTelnyxStatusByop(
    @Param("tenantId") tenantId: string,
    @Req() req: Request & { rawBody?: Buffer | string },
    @Body() body: any,
    @Headers("telnyx-signature-ed25519") signature?: string,
    @Headers("telnyx-timestamp") timestamp?: string,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptTelnyxStatusByTenant(
      this.raw(req),
      { signature, timestamp },
      body,
      tenantId,
    );
  }

  @Post("africastalking/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Africa's Talking inbound SMS webhooks (managed/global)" })
  async handleAfricasTalkingInbound(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptAfricasTalking(headers, body);
  }

  @Post("africastalking/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Africa's Talking delivery report webhooks (managed/global)" })
  async handleAfricasTalkingStatus(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptAfricasTalkingStatus(headers, body);
  }

  @Post("africastalking/:tenantId/inbound")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Africa's Talking inbound SMS webhooks (BYOP, tenant-scoped)" })
  async handleAfricasTalkingInboundByop(
    @Param("tenantId") tenantId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptAfricasTalkingByTenant(headers, body, tenantId);
  }

  @Post("africastalking/:tenantId/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Handle Africa's Talking status webhooks (BYOP, tenant-scoped)" })
  async handleAfricasTalkingStatusByop(
    @Param("tenantId") tenantId: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    return this.intake.acceptAfricasTalkingStatusByTenant(headers, body, tenantId);
  }

  @Post("status/:provider")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generic SMS status webhook (provider-routed)" })
  async handleGenericStatus(
    @Req() req: Request & { rawBody?: Buffer | string },
    @RawBody() rawBody: Buffer,
    @Param("provider") provider: string,
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ success: boolean }> {
    const p = (provider || "").toLowerCase();
    if (p === "telnyx")
      return this.handleTelnyxStatus(
        req,
        body,
        headers["telnyx-signature-ed25519"],
        headers["telnyx-timestamp"],
      );
    if (p === "africastalking" || p === "africas-talking")
      return this.handleAfricasTalkingStatus(body, headers);
    if (p === "twilio")
      return this.handleTwilioStatus(rawBody, body, headers["x-twilio-signature"]);
    if (p === "termii") return this.handleTermiiStatus(body, headers);
    if (p === "infobip") return this.handleInfobipStatus(body, headers);
    throw new BadRequestException("Unsupported SMS webhook provider");
  }

  private raw(req: Request & { rawBody?: Buffer | string }): string | undefined {
    const raw = req.rawBody;
    if (typeof raw === "string") return raw;
    if (Buffer.isBuffer(raw)) return raw.toString("utf8");
    return undefined;
  }
}
