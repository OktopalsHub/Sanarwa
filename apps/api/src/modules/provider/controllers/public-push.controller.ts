import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import { ApiKeyAuthGuard } from '../../api-key/guards/api-key-auth.guard';
import { CurrentApiKey } from '../../auth/decorators/current-api-key.decorator';
import { CurrentProjectId } from '../../auth/decorators/current-project.decorator';
import { NotificationEngineService } from '../../notifications/engine/notification-engine.service';

export class SendPushNotificationDto {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  category?: string;
  threadId?: string;
  imageUrl?: string;
  actionUrl?: string;
  scheduledAt?: string;
  expiresAt?: string;
  priority?: 'normal' | 'high';
  collapseKey?: string;
  timeToLive?: number;
}

export class BulkPushNotificationDto {
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  category?: string;
  imageUrl?: string;
  actionUrl?: string;
  priority?: 'normal' | 'high';
  notifications: Array<{
    to: string;
    data?: Record<string, any>;
  }>;
}

export class PushNotificationQueryDto {
  page?: number;
  limit?: number;
  status?: 'pending' | 'sent' | 'delivered' | 'failed';
  deviceToken?: string;
  startDate?: string;
  endDate?: string;
}

@ApiTags('Push Notifications (SDK)')
@Controller('push')
@UseGuards(ApiKeyAuthGuard)
export class PublicPushController {
  constructor(
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Send push notification (SDK)' })
  @ApiResponse({
    status: 201,
    description: 'Push notification sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API Key for authentication',
    required: true,
  })
  async sendPushNotification(
    @Body() sendDto: SendPushNotificationDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const result = await this.notificationEngine.send({
      tenantId: apiKey.project.tenant.id,
      projectId,
      channel: 'push',
      to: sendDto.to,
      title: sendDto.title,
      message: sendDto.body,
      data: sendDto.data,
      priority: sendDto.priority === 'high' ? 'high' : 'normal',
      scheduledAt: sendDto.scheduledAt
        ? new Date(sendDto.scheduledAt)
        : undefined,
      expiresAt: sendDto.expiresAt ? new Date(sendDto.expiresAt) : undefined,
      subscriberId: sendDto.to,
      metadata: {
        badge: sendDto.badge,
        sound: sendDto.sound,
        category: sendDto.category,
        threadId: sendDto.threadId,
        imageUrl: sendDto.imageUrl,
        actionUrl: sendDto.actionUrl,
        timeToLive: sendDto.timeToLive,
      },
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
      tenantId: apiKey.project.tenant.id,
    };
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Send bulk push notifications (SDK)' })
  @ApiResponse({
    status: 201,
    description: 'Bulk push notifications sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'API Key for authentication',
    required: true,
  })
  async sendBulkPushNotifications(
    @Body() bulkDto: BulkPushNotificationDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const batchId = `batch_${Date.now()}`;
    const notifications = await Promise.all(
      bulkDto.notifications.map((notification, index) =>
        this.notificationEngine
          .send({
            tenantId: apiKey.project.tenant.id,
            projectId,
            channel: 'push',
            to: notification.to,
            title: bulkDto.title,
            message: bulkDto.body,
            data: { ...bulkDto.data, ...notification.data },
            priority: bulkDto.priority === 'high' ? 'high' : 'normal',
            subscriberId: notification.to,
            trackingId: `${batchId}_${index}`,
            metadata: {
              imageUrl: bulkDto.imageUrl,
              actionUrl: bulkDto.actionUrl,
              category: bulkDto.category,
            },
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
      status: 'queued',
      totalNotifications: bulkDto.notifications.length,
      title: bulkDto.title,
      body: bulkDto.body,
      projectId,
      tenantId: apiKey.project.tenant.id,
      notifications,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get push notification history (SDK)' })
  @ApiResponse({
    status: 200,
    description: 'Push notification history retrieved successfully',
  })
  async getPushNotificationHistory(
    @Query() query: PushNotificationQueryDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    return {
      data: [],
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
        total: 0,
        totalPages: 0,
      },
      projectId,
      tenantId: apiKey.project.tenant.id,
      note: 'Use notification logs analytics for delivery history metadata.',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get push notification statistics (SDK)' })
  @ApiResponse({
    status: 200,
    description: 'Push notification statistics retrieved successfully',
  })
  async getPushStats(
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      deliveryRate: 0,
      failureRate: 0,
      avgDeliveryTime: 0,
      topDevicePlatforms: [],
      period: {
        startDate:
          startDate ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: endDate || new Date().toISOString(),
      },
      projectId,
      tenantId: apiKey.project.tenant.id,
      note: 'Use /notifications/analytics for metadata-only delivery stats.',
    };
  }
}
