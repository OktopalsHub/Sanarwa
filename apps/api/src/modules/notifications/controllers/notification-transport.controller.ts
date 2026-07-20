import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiHeader } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../api-key/guards/api-key-auth.guard';
import { CurrentApiKey } from '../../auth/decorators/current-api-key.decorator';
import { CurrentProjectId } from '../../auth/decorators/current-project.decorator';
import { ApiKey } from '../../api-key/entities/api-key.entity';
import { 
  NotificationTransportService, 
  NotificationRequest, 
  BulkNotificationRequest 
} from '../transport/notification-transport.service';

export class SendNotificationDto {
  to: string;
  channel: 'email' | 'sms' | 'push' | 'whatsapp' | 'webhook' | 'in_app';
  title?: string;
  message: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
  scheduledAt?: string; // ISO date string
  expiresAt?: string; // ISO date string
  templateId?: string;
  templateData?: Record<string, any>;
  trackingId?: string;
  webhookUrl?: string;
}

export class BulkSendNotificationDto {
  notifications: SendNotificationDto[];
  batchId?: string;
}

@ApiTags('Notification Transport (SDK)')
@Controller('notifications')
@UseGuards(ApiKeyAuthGuard)
export class NotificationTransportController {
  constructor(
    private readonly transportService: NotificationTransportService,
  ) {}

  @Post('send')
  @ApiOperation({ summary: 'Send single notification (Transport)' })
  @ApiResponse({
    status: 201,
    description: 'Notification queued for delivery',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  async sendNotification(
    @Body() sendDto: SendNotificationDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const request: NotificationRequest = {
      to: sendDto.to,
      channel: sendDto.channel,
      title: sendDto.title,
      message: sendDto.message,
      data: sendDto.data,
      priority: sendDto.priority,
      scheduledAt: sendDto.scheduledAt ? new Date(sendDto.scheduledAt) : undefined,
      expiresAt: sendDto.expiresAt ? new Date(sendDto.expiresAt) : undefined,
      templateId: sendDto.templateId,
      templateData: sendDto.templateData,
      trackingId: sendDto.trackingId,
      webhookUrl: sendDto.webhookUrl,
      tenantId: apiKey.project.tenant.id,
      projectId,
    };

    return this.transportService.send(request);
  }

  @Post('send/bulk')
  @ApiOperation({ summary: 'Send bulk notifications (Transport)' })
  @ApiResponse({
    status: 201,
    description: 'Bulk notifications queued for delivery',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  async sendBulkNotifications(
    @Body() bulkDto: BulkSendNotificationDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ) {
    const request: BulkNotificationRequest = {
      notifications: bulkDto.notifications.map(notification => ({
        to: notification.to,
        channel: notification.channel,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        scheduledAt: notification.scheduledAt ? new Date(notification.scheduledAt) : undefined,
        expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined,
        templateId: notification.templateId,
        templateData: notification.templateData,
        trackingId: notification.trackingId,
        webhookUrl: notification.webhookUrl,
        tenantId: apiKey.project.tenant.id,
        projectId,
      })),
      batchId: bulkDto.batchId,
    };

    return this.transportService.sendBulk(request);
  }

  @Get('status/:trackingId')
  @ApiOperation({ summary: 'Get notification delivery status' })
  @ApiResponse({
    status: 200,
    description: 'Delivery status retrieved successfully',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  async getDeliveryStatus(
    @Param('trackingId') trackingId: string,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const log = await this.transportService.getDeliveryStatus(trackingId);
    
    if (!log || log.tenantId !== apiKey.project.tenant.id) {
      return { error: 'Notification not found' };
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

  @Get('analytics')
  @ApiOperation({ summary: 'Get notification analytics' })
  @ApiResponse({
    status: 200,
    description: 'Analytics retrieved successfully',
  })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  async getAnalytics(
    @CurrentApiKey() apiKey: ApiKey,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('channel') channel?: string,
  ) {
    return this.transportService.getAnalytics(apiKey.project.tenant.id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      channel,
    });
  }

  @Get('health')
  @ApiOperation({ summary: 'Check transport service health' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
  })
  async getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        email: 'operational',
        sms: 'operational',
        push: 'operational',
        whatsapp: 'operational',
        webhook: 'operational',
        in_app: 'operational',
      },
    };
  }
}