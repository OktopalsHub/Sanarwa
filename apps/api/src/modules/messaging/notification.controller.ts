import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../api-key/guards/api-key-auth.guard';
import { CurrentApiKey } from '../auth/decorators/current-api-key.decorator';
import { CurrentProjectId } from '../auth/decorators/current-project.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ApiKey } from '../api-key/entities/api-key.entity';

import { 
  NotificationRequestDto, 
  BulkNotificationRequestDto 
} from './dto/notification-request.dto';
import { 
  NotificationResponseDto, 
  BulkNotificationResponseDto,
  NotificationStatusDto 
} from './dto/notification-response.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller('notifications')
@Public()
@UseGuards(ApiKeyAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Send a notification' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully', type: NotificationResponseDto })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  async sendNotification(
    @Body() request: NotificationRequestDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ): Promise<NotificationResponseDto> {
    // API key is validated and available
    // You can access: apiKey.id, apiKey.project, projectId, etc.
    return this.notificationService.sendNotification(request);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Send bulk notifications' })
  @ApiResponse({ status: 201, description: 'Bulk notifications processed', type: BulkNotificationResponseDto })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  async sendBulkNotifications(
    @Body() request: BulkNotificationRequestDto,
    @CurrentApiKey() apiKey: ApiKey,
    @CurrentProjectId() projectId: string,
  ): Promise<BulkNotificationResponseDto> {
    // API key is validated and available
    return this.notificationService.sendBulkNotifications(request);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get notification status' })
  @ApiResponse({ status: 200, description: 'Notification status retrieved', type: NotificationStatusDto })
  async getStatus(@Param('id') id: string, @Query('tenantId') tenantId: string): Promise<NotificationStatusDto> {
    return this.notificationService.getNotificationStatus(id, tenantId);
  }
}