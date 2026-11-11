import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MessageEvent,
  NotFoundException,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { concat, from, interval, of, Observable } from "rxjs";
import { mergeMap, map } from "rxjs/operators";
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiKeyAuthGuard } from "../../api-key/guards/api-key-auth.guard";
import { CurrentApiKey } from "../../auth/decorators/current-api-key.decorator";
import { CurrentProjectId } from "../../auth/decorators/current-project.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import type { MachineApiKey } from "../../auth/decorators/current-api-key.decorator";
import { NotificationEngineService } from "../engine/notification-engine.service";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import {
  MessageDelivery,
  MessageDeliveryStatus,
  applyDeliveryState,
} from "../../messaging/message-delivery.entity";
import { NotificationLog } from "../entities/notification-log.entity";
import { WebPushSubscriptionService } from "../../provider/services/web-push-subscription.service";

export class PushActionDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  deepLink?: string;

  @IsOptional()
  @IsBoolean()
  destructive?: boolean;
}

export class PushDeepLinkDto {
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  fallbackUrl?: string;

  @IsOptional()
  @IsString()
  androidAction?: string;

  @IsOptional()
  @IsString()
  iosCategory?: string;
}

export class PushLightsDto {
  @IsString()
  color: string;

  @IsInt()
  onMs: number;

  @IsInt()
  offMs: number;
}

export class PushAndroidDto {
  @IsOptional()
  @IsString()
  channelId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsBoolean()
  sticky?: boolean;

  @IsOptional()
  @IsArray()
  vibrate?: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PushLightsDto)
  lights?: PushLightsDto;
}

export class PushIosDto {
  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  launchImage?: string;

  @IsOptional()
  @IsBoolean()
  mutableContent?: boolean;

  @IsOptional()
  @IsBoolean()
  contentAvailable?: boolean;

  @IsOptional()
  @IsIn(["passive", "active", "timeSensitive", "critical"])
  interruptionLevel?: "passive" | "active" | "timeSensitive" | "critical";
}

export class SendPushNotificationDto {
  @IsString()
  to: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsInt()
  badge?: number;

  @IsOptional()
  @IsString()
  sound?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PushActionDto)
  actions?: PushActionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PushDeepLinkDto)
  deepLink?: PushDeepLinkDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PushAndroidDto)
  android?: PushAndroidDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PushIosDto)
  ios?: PushIosDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsIn(["low", "normal", "high"])
  priority?: "low" | "normal" | "high";

  @IsOptional()
  @IsString()
  collapseKey?: string;

  @IsOptional()
  @IsInt()
  timeToLive?: number;
}

export class BulkPushNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsInt()
  badge?: number;

  @IsOptional()
  @IsString()
  sound?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  actionUrl?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PushActionDto)
  actions?: PushActionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PushDeepLinkDto)
  deepLink?: PushDeepLinkDto;

  @IsOptional()
  @IsIn(["low", "normal", "high"])
  priority?: "low" | "normal" | "high";

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkPushItemDto)
  notifications: BulkPushItemDto[];
}

export class BulkPushItemDto {
  @IsString()
  to: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class PushNotificationQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  @IsIn([
    "pending",
    "sent",
    "delivered",
    "failed",
    "bounced",
    "opened",
    "clicked",
    "unsubscribed",
    "skipped",
  ])
  status?: MessageDeliveryStatus;

  @IsOptional()
  @IsString()
  deviceToken?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  since?: string;
}

export class PushAckDto {
  @IsIn(["delivered", "opened", "clicked"])
  status: MessageDeliveryStatus;
}

export class WebPushSubscriptionKeysDto {
  @IsString()
  p256dh: string;

  @IsString()
  auth: string;
}

export class WebPushSubscriptionDto {
  @IsString()
  endpoint: string;

  @ValidateNested()
  @Type(() => WebPushSubscriptionKeysDto)
  keys: WebPushSubscriptionKeysDto;
}

@ApiTags("Push Notifications (SDK)")
@Controller("push")
@Public()
@UseGuards(ApiKeyAuthGuard)
export class PublicPushController {
  constructor(
    private readonly notificationEngine: NotificationEngineService,
    private readonly webPushSubscriptions: WebPushSubscriptionService,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
  ) {}

  @Post()
  @ApiOperation({ summary: "Send push notification (SDK)" })
  @ApiResponse({ status: 201, description: "Push notification sent successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiHeader({
    name: "X-API-Key",
    description: "API Key for authentication",
    required: true,
  })
  async sendPushNotification(
    @Body() sendDto: SendPushNotificationDto,
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const result = await this.notificationEngine.send({
      tenantId: apiKey.tenantId,
      projectId,
      channel: NotificationChannel.PUSH,
      to: sendDto.to,
      title: sendDto.title,
      message: sendDto.body,
      variables: sendDto.variables,
      priority:
        sendDto.priority === "high" ? "high" : sendDto.priority === "low" ? "low" : "normal",
      scheduledAt: sendDto.scheduledAt ? new Date(sendDto.scheduledAt) : undefined,
      expiresAt: sendDto.expiresAt ? new Date(sendDto.expiresAt) : undefined,
      subscriberId: sendDto.to,
      metadata: this.richMetadata(sendDto),
    });

    return {
      id: result.id,
      trackingId: result.trackingId,
      status: result.status,
      deviceToken: sendDto.to,
      title: sendDto.title,
      body: sendDto.body,
      scheduledAt: sendDto.scheduledAt,
      externalId: result.externalId,
      error: result.error,
      projectId,
      tenantId: apiKey.tenantId,
    };
  }

  @Post("bulk")
  @ApiOperation({ summary: "Send bulk push notifications (SDK)" })
  @ApiResponse({ status: 201, description: "Bulk push notifications sent successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiHeader({
    name: "X-API-Key",
    description: "API Key for authentication",
    required: true,
  })
  async sendBulkPushNotifications(
    @Body() bulkDto: BulkPushNotificationDto,
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const batchId = `batch_${Date.now()}`;
    const notifications = await Promise.all(
      bulkDto.notifications.map((notification, index) =>
        this.notificationEngine
          .send({
            tenantId: apiKey.tenantId,
            projectId,
            channel: NotificationChannel.PUSH,
            to: notification.to,
            title: bulkDto.title,
            message: bulkDto.body,
            variables: { ...bulkDto.variables, ...notification.variables },
            priority: bulkDto.priority === "high" ? "high" : "normal",
            subscriberId: notification.to,
            trackingId: `${batchId}_${index}`,
            metadata: this.richMetadata(bulkDto),
          })
          .then((result) => ({
            id: result.id,
            deviceToken: notification.to,
            status: result.status,
            trackingId: result.trackingId,
            externalId: result.externalId,
            error: result.error,
          })),
      ),
    );

    return {
      batchId,
      status: "queued",
      totalNotifications: bulkDto.notifications.length,
      title: bulkDto.title,
      body: bulkDto.body,
      projectId,
      tenantId: apiKey.tenantId,
      notifications,
    };
  }

  @Post(":trackingId/ack")
  @ApiOperation({ summary: "Acknowledge a push delivery (client receipt)" })
  @ApiResponse({ status: 200, description: "Delivery acknowledged" })
  @ApiResponse({ status: 404, description: "Delivery not found" })
  async acknowledgePush(
    @Param("trackingId") trackingId: string,
    @Body() dto: PushAckDto,
    @CurrentApiKey() apiKey: MachineApiKey,
  ) {
    const delivery = await this.findDeliveryByTrackingId(trackingId, apiKey.tenantId);
    if (!delivery) {
      throw new NotFoundException(`No delivery for tracking id ${trackingId}`);
    }

    const now = new Date();
    const deliveryState: Partial<MessageDelivery> = { status: dto.status };
    if (
      dto.status === MessageDeliveryStatus.DELIVERED ||
      dto.status === MessageDeliveryStatus.OPENED ||
      dto.status === MessageDeliveryStatus.CLICKED
    ) {
      deliveryState.deliveredAt = delivery.deliveredAt ?? now;
    }
    if (
      dto.status === MessageDeliveryStatus.OPENED ||
      dto.status === MessageDeliveryStatus.CLICKED
    ) {
      deliveryState.openedAt = delivery.openedAt ?? now;
    }
    if (dto.status === MessageDeliveryStatus.CLICKED) {
      deliveryState.clickedAt = now;
    }

    applyDeliveryState(deliveryState, { status: dto.status });

    const update: Record<string, unknown> = {
      status: deliveryState.status,
      transportStatus: deliveryState.transportStatus,
      engagementStatus: deliveryState.engagementStatus,
      stateUpdatedAt: deliveryState.stateUpdatedAt,
    };
    if (
      deliveryState.status === MessageDeliveryStatus.DELIVERED ||
      deliveryState.status === MessageDeliveryStatus.OPENED ||
      deliveryState.status === MessageDeliveryStatus.CLICKED
    ) {
      update.deliveredAt = deliveryState.deliveredAt;
    }
    if (
      deliveryState.status === MessageDeliveryStatus.OPENED ||
      deliveryState.status === MessageDeliveryStatus.CLICKED
    ) {
      update.openedAt = deliveryState.openedAt;
    }
    if (deliveryState.status === MessageDeliveryStatus.CLICKED) {
      update.clickedAt = deliveryState.clickedAt;
    }

    await this.deliveryRepository.update(delivery.id, update as any);

    return {
      trackingId,
      deliveryId: delivery.id,
      status: dto.status,
      acknowledgedAt: now,
    };
  }

  @Get()
  @ApiOperation({ summary: "Get push notification history (SDK)" })
  @ApiResponse({
    status: 200,
    description: "Push notification history retrieved successfully",
  })
  async getPushNotificationHistory(
    @Query() query: PushNotificationQueryDto,
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = Math.min(query.limit && query.limit > 0 ? query.limit : 10, 100);

    const builder = this.deliveryRepository
      .createQueryBuilder("delivery")
      .where("delivery.tenantId = :tenantId", { tenantId: apiKey.tenantId })
      .andWhere("delivery.channel = :channel", { channel: NotificationChannel.PUSH })
      .orderBy("delivery.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query.deviceToken) {
      builder.andWhere("delivery.recipient = :recipient", { recipient: query.deviceToken });
    }
    if (query.status) {
      builder.andWhere("delivery.status = :status", { status: query.status });
    }
    if (query.startDate) {
      builder.andWhere("delivery.createdAt >= :startDate", {
        startDate: new Date(query.startDate),
      });
    }
    if (query.endDate) {
      builder.andWhere("delivery.createdAt <= :endDate", { endDate: new Date(query.endDate) });
    }
    if (query.since) {
      builder.andWhere("delivery.createdAt >= :since", { since: new Date(query.since) });
    }

    const [rows, total] = await builder.getManyAndCount();

    return {
      data: rows.map((row) => ({
        id: row.id,
        messageId: row.messageId,
        deviceToken: row.recipient,
        status: row.status,
        providerId: row.providerId,
        providerMessageId: row.providerMessageId,
        errorMessage: row.errorMessage,
        retryCount: row.retryCount,
        sentAt: row.sentAt,
        deliveredAt: row.deliveredAt,
        openedAt: row.openedAt,
        clickedAt: row.clickedAt,
        createdAt: row.createdAt,
        metadata: row.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      projectId,
      tenantId: apiKey.tenantId,
    };
  }

  /**
   * Public Server-Sent Events stream of push delivery state (ntfy-style
   * JSON stream). Emits delivery rows created since `since`, then a
   * keepalive ping until the client disconnects.
   */
  @Sse("stream")
  @ApiOperation({ summary: "Stream push delivery events (SSE)" })
  @ApiResponse({ status: 200, description: "Server-Sent Events stream" })
  async streamPush(
    @Query("since") since: string | undefined,
    @CurrentApiKey() apiKey: MachineApiKey,
  ): Promise<Observable<MessageEvent>> {
    const tenantId = apiKey.tenantId;
    const sinceDate = new Date(since ?? Date.now() - 60_000);

    const connected = of<MessageEvent>({
      type: "connected",
      data: JSON.stringify({ tenantId }),
    });

    const poll = interval(5000).pipe(
      mergeMap(async () => {
        const rows = await this.deliveryRepository
          .createQueryBuilder("delivery")
          .select("delivery.id", "id")
          .addSelect("delivery.status", "status")
          .addSelect("delivery.recipient", "recipient")
          .addSelect("delivery.createdAt", "createdAt")
          .where("delivery.tenantId = :tenantId", { tenantId })
          .andWhere("delivery.channel = :channel", { channel: NotificationChannel.PUSH })
          .andWhere("delivery.createdAt >= :since", { since: sinceDate })
          .orderBy("delivery.createdAt", "ASC")
          .take(50)
          .getRawMany();
        return rows.map<MessageEvent>((row) => ({
          type: "delivery",
          data: JSON.stringify(row),
          id: String(row.id),
        }));
      }),
      mergeMap((events) => from(events)),
    );

    return concat(connected, poll) as unknown as Observable<MessageEvent>;
  }

  @Get("stats")
  @ApiOperation({ summary: "Get push notification statistics (SDK)" })
  @ApiResponse({
    status: 200,
    description: "Push notification statistics retrieved successfully",
  })
  async getPushStats(
    @CurrentApiKey() apiKey: MachineApiKey,
    @CurrentProjectId() projectId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const counts = await this.deliveryRepository
      .createQueryBuilder("delivery")
      .select("delivery.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("delivery.tenantId = :tenantId", { tenantId: apiKey.tenantId })
      .andWhere("delivery.channel = :channel", { channel: NotificationChannel.PUSH })
      .andWhere("delivery.createdAt >= :start", { start })
      .andWhere("delivery.createdAt <= :end", { end })
      .groupBy("delivery.status")
      .getRawMany<{ status: string; count: string }>();

    const byStatus = new Map(counts.map((row) => [row.status, Number(row.count)]));
    const totalSent = [...byStatus.values()].reduce((sum, value) => sum + value, 0) || 0;
    const delivered = byStatus.get(MessageDeliveryStatus.DELIVERED) ?? 0;
    const failed = byStatus.get(MessageDeliveryStatus.FAILED) ?? 0;

    return {
      totalSent,
      totalDelivered:
        delivered +
        (byStatus.get(MessageDeliveryStatus.OPENED) ?? 0) +
        (byStatus.get(MessageDeliveryStatus.CLICKED) ?? 0),
      totalFailed: failed,
      deliveryRate:
        totalSent > 0
          ? (delivered +
              (byStatus.get(MessageDeliveryStatus.OPENED) ?? 0) +
              (byStatus.get(MessageDeliveryStatus.CLICKED) ?? 0)) /
            totalSent
          : 0,
      failureRate: totalSent > 0 ? failed / totalSent : 0,
      topDevicePlatforms: [],
      byStatus: Object.fromEntries(byStatus),
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      projectId,
      tenantId: apiKey.tenantId,
    };
  }

  @Post("web-subscriptions")
  @ApiOperation({ summary: "Register a browser Web Push subscription (VAPID)" })
  @ApiResponse({ status: 201, description: "Web push subscription registered" })
  @ApiResponse({ status: 400, description: "Bad Request - invalid subscription" })
  async registerWebPushSubscription(
    @Body() dto: WebPushSubscriptionDto,
    @CurrentApiKey() apiKey: MachineApiKey,
  ) {
    if (!dto.endpoint.startsWith("https://")) {
      throw new BadRequestException("Webhook endpoint must be an https URL");
    }
    const subscription = await this.webPushSubscriptions.register(
      apiKey.tenantId,
      apiKey.tenantId,
      {
        endpoint: dto.endpoint,
        keys: { p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      },
    );
    return {
      id: subscription.id,
      endpoint: dto.endpoint,
      isActive: subscription.isActive,
    };
  }

  private richMetadata(
    dto: SendPushNotificationDto | BulkPushNotificationDto,
  ): Record<string, unknown> {
    const single = dto as SendPushNotificationDto;
    return {
      badge: dto.badge,
      sound: dto.sound,
      category: dto.category,
      threadId: single.threadId,
      imageUrl: dto.imageUrl,
      actionUrl: dto.actionUrl,
      timeToLive: single.timeToLive,
      collapseKey: single.collapseKey,
      actions: dto.actions,
      deepLink: dto.deepLink,
      android: single.android,
      ios: single.ios,
      tags: single.tags,
      topic: single.topic,
    };
  }

  private async findDeliveryByTrackingId(
    trackingId: string,
    tenantId: string,
  ): Promise<MessageDelivery | null> {
    const log = await this.logRepository.findOne({
      where: { tenantId, trackingId },
    });

    const deliveryId = log?.metadata?.deliveryId;
    if (deliveryId) {
      return this.deliveryRepository.findOne({
        where: { tenantId, id: deliveryId },
      });
    }

    const delivery = await this.deliveryRepository
      .createQueryBuilder("delivery")
      .where("delivery.tenantId = :tenantId", { tenantId })
      .andWhere("delivery.metadata->>'trackingId' = :trackingId", { trackingId })
      .getOne();

    return delivery ?? null;
  }
}
