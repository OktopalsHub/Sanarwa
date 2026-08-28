import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiKeyAuthGuard } from "../api-key/guards/api-key-auth.guard";
import { Public } from "../auth/decorators/public.decorator";
import { NotificationEngineService } from "../notifications/engine/notification-engine.service";
import {
  NotificationChannel,
  NotificationEngineResponse,
} from "../notifications/engine/notification-engine.types";
import { PublicSendMessageDto } from "./dto/public-send-message.dto";

@ApiTags("messages")
@Controller("messages")
export class MessagesController {
  constructor(private readonly notificationEngine: NotificationEngineService) {}

  @Post()
  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Send a message (Resend-style public alias)" })
  @ApiHeader({
    name: "Authorization",
    description: "Bearer API key",
    required: false,
  })
  @ApiHeader({ name: "X-API-Key", required: false })
  @ApiResponse({ status: 201, description: "Message accepted" })
  async send(
    @Body() dto: PublicSendMessageDto,
    @Req() req: { apiKey?: { tenantId?: string; projectId?: string } },
  ) {
    const tenantId = req.apiKey?.tenantId;
    const projectId = req.apiKey?.projectId;
    if (!tenantId || !projectId) {
      throw new UnauthorizedException("API key is missing tenant or project");
    }

    const recipients = Array.isArray(dto.to) ? dto.to : [dto.to];
    const body = dto.html || dto.text || "";
    const results: NotificationEngineResponse[] = [];

    for (const to of recipients) {
      results.push(
        await this.notificationEngine.send({
          tenantId,
          projectId,
          channel: dto.channel as NotificationChannel,
          to,
          title: dto.subject,
          message: body,
          templateId: dto.templateId,
          metadata: {
            from: dto.from,
            html: dto.html,
            text: dto.text,
          },
        }),
      );
    }

    const first = results[0];
    return {
      id: first?.trackingId ?? first?.id,
      object: "message",
      channel: dto.channel,
      to: recipients,
      status: first?.status ?? "queued",
      deliveries: results,
    };
  }
}
