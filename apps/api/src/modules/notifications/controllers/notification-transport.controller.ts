import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiKeyAuthGuard } from "../../api-key/guards/api-key-auth.guard";
import { CurrentApiKey } from "../../auth/decorators/current-api-key.decorator";
import { CurrentProjectId } from "../../auth/decorators/current-project.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { MachineApiKey } from "../../auth/decorators/current-api-key.decorator";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { NotificationEngineService } from "../engine/notification-engine.service";
import { NotificationTransportService } from "../transport/notification-transport.service";
import { SendUnifiedDto } from "../../messaging/dto/unified-send.dto";
import { UnifiedSendService } from "../../messaging/unified-send.service";

export class BulkSendNotificationDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SendUnifiedDto)
  notifications: SendUnifiedDto[];

  @IsOptional()
  @IsString()
  batchId?: string;
}

const INGEST_CHANNELS = [
  "email",
  "sms",
  "push",
  "whatsapp",
  "in_app",
  "voice",
  "webhook",
  "chat",
] as const;

/**
 * ntfy-style publish: any GET becomes a message. Grafana, Alertmanager and
 * curl hits land here; the API key on the request scopes tenant + project.
 */
export class IngestQueryDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsIn([...INGEST_CHANNELS])
  channel?: string;

  @IsOptional()
  @IsIn(["low", "normal", "high", "urgent"])
  priority?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

@ApiTags("Notification Transport (SDK)")
@Controller("notifications")
@Public()
@UseGuards(ApiKeyAuthGuard)
export class NotificationTransportController {
  constructor(
    private readonly transportService: NotificationTransportService,
    private readonly unifiedSendService: UnifiedSendService,
    private readonly engine: NotificationEngineService,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Transport health check" })
  @ApiResponse({ status: 200, description: "Transport is healthy" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  async health() {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        email: "operational",
        sms: "operational",
        push: "operational",
        whatsapp: "operational",
        webhook: "operational",
        in_app: "operational",
      },
    };
  }

  @Get("ingest")
  @ApiOperation({ summary: "Publish a notification via GET (ntfy-style ingest)" })
  @ApiResponse({ status: 200, description: "Notification published" })
  @ApiResponse({ status: 400, description: "Missing message/topic/to or invalid query" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  async ingest(
    @Query() query: IngestQueryDto,
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const message = (query.message ?? query.text ?? query.body)?.trim();
    if (!message) {
      throw new BadRequestException("Provide message, text, or body");
    }

    const topic = query.topic?.trim() || undefined;
    const to = query.to?.trim() || undefined;
    if (!topic && !to) {
      throw new BadRequestException("Provide topic or to");
    }

    let data: Record<string, unknown> | undefined;
    if (query.data) {
      try {
        data = JSON.parse(query.data) as Record<string, unknown>;
      } catch {
        throw new BadRequestException("data must be valid JSON");
      }
    }

    const scheduledAt = toDate(query.scheduledAt, "scheduledAt");
    const expiresAt = toDate(query.expiresAt, "expiresAt");
    const priority =
      query.priority === "high" || query.priority === "urgent"
        ? "high"
        : query.priority === "low"
          ? "low"
          : "normal";
    const tags = query.tags
      ? query.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
      : undefined;

    const result = await this.engine.send({
      tenantId: apiKey.tenantId,
      projectId,
      channel: (query.channel ?? NotificationChannel.PUSH) as NotificationChannel,
      to: to ?? topic!,
      title: query.title,
      message,
      variables: data,
      priority,
      scheduledAt,
      expiresAt,
      subscriberId: to ?? topic,
      metadata: { source: "ingest", topic, tags },
    });

    return {
      id: result.id,
      trackingId: result.trackingId,
      messageId: result.messageId,
      status: result.status,
      externalId: result.externalId,
      error: result.error,
      topic: topic ?? null,
    };
  }

  @Post("send")
  @ApiOperation({ summary: "Send single notification (Transport)" })
  @ApiResponse({
    status: 201,
    description: "Notification queued for delivery",
  })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiHeader({
    name: "X-Idempotency-Key",
    description: "Optional — at most one send per key",
    required: false,
  })
  async sendNotification(
    @Body() sendDto: SendUnifiedDto,
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    return this.unifiedSendService.send(sendDto, apiKey.tenantId, projectId, idempotencyKey);
  }

  @Post("send/bulk")
  @ApiOperation({ summary: "Send bulk notifications (Transport)" })
  @ApiResponse({
    status: 201,
    description: "Bulk notifications queued for delivery",
  })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  async sendBulkNotifications(
    @Body() bulkDto: BulkSendNotificationDto,
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const notifications = await Promise.all(
      bulkDto.notifications.map(async (notification) => {
        try {
          return await this.unifiedSendService.send(notification, apiKey.tenantId, projectId);
        } catch (error) {
          return {
            messageId: undefined,
            status: "failed" as const,
            deliveries: [],
            error: error instanceof Error ? error.message : "Send failed",
          };
        }
      }),
    );

    return {
      batchId: bulkDto.batchId ?? `batch_${randomUUID()}`,
      totalNotifications: notifications.length,
      notifications,
    };
  }

  @Get("status/:trackingId")
  @ApiOperation({ summary: "Get notification delivery status" })
  @ApiResponse({
    status: 200,
    description: "Delivery status retrieved successfully",
  })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  async getDeliveryStatus(
    @Param("trackingId") trackingId: string,
    @CurrentApiKey() apiKey: MachineApiKey,
  ) {
    const log = await this.transportService.getDeliveryStatus(trackingId);

    if (!log || log.tenantId !== apiKey.tenantId) {
      return { error: "Notification not found" };
    }

    return {
      trackingId: log.trackingId,
      channel: log.channel,
      status: log.status,
      sentAt: log.sentAt,
      deliveredAt: log.deliveredAt,
      error: log.error,
      externalId: log.externalId,
    };
  }

  @Get("analytics")
  @ApiOperation({ summary: "Get notification analytics" })
  @ApiResponse({
    status: 200,
    description: "Analytics retrieved successfully",
  })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  async getAnalytics(
    @CurrentApiKey() apiKey: MachineApiKey,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("channel") channel?: string,
  ) {
    return this.transportService.getAnalytics(apiKey.tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      channel,
    });
  }
}

function toDate(value: string | undefined, field: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }
  return date;
}
