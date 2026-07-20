import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationCenterService } from '../services/notification-center.service';
import { NotificationCenterStatus } from '../entities/notification-center.entity';
import { CurrentTenantId } from '../../../common/decorators/current-context.decorator';
@ApiTags('notifications/center')
@Controller('tenants/:tenantId/notifications/center')
@ApiBearerAuth()
export class NotificationCenterController {
  constructor(private readonly service: NotificationCenterService) {}

  /**
   * Get notification feed for subscriber
   */
  @Get('feed/:subscriberId')
  @ApiOperation({ summary: 'Get notification feed' })
  async getFeed(
    @Param('tenantId') tenantId: string,
    @Param('subscriberId') subscriberId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: NotificationCenterStatus,
  ) {
    return this.service.getNotificationFeed(
      subscriberId,
      tenantId,
      page,
      limit,
      status,
    );
  }

  /**
   * Get notification by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  async getNotification(@Param('id') id: string) {
    return this.service.getNotification(id);
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string) {
    return this.service.markAsRead(id);
  }

  /**
   * Mark multiple notifications as read
   */
  @Post('bulk/read')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async markMultipleAsRead(@Body() body: { ids: string[] }) {
    await this.service.markMultipleAsRead(body.ids);
  }

  /**
   * Mark all notifications as read
   */
  @Post(':subscriberId/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(
    @Param('tenantId') tenantId: string,
    @Param('subscriberId') subscriberId: string,
  ) {
    await this.service.markAllAsRead(subscriberId, tenantId);
  }

  /**
   * Archive notification
   */
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive notification' })
  async archiveNotification(@Param('id') id: string) {
    return this.service.archiveNotification(id);
  }

  /**
   * Archive multiple notifications
   */
  @Post('bulk/archive')
  @ApiOperation({ summary: 'Archive multiple notifications' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveMultiple(@Body() body: { ids: string[] }) {
    await this.service.archiveMultiple(body.ids);
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(@Param('id') id: string) {
    await this.service.deleteNotification(id);
  }

  /**
   * Delete multiple notifications
   */
  @Post('bulk/delete')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMultiple(@Body() body: { ids: string[] }) {
    await this.service.deleteMultiple(body.ids);
  }

  /**
   * Get notification center statistics
   */
  @Get('stats/:subscriberId')
  @ApiOperation({ summary: 'Get notification center statistics' })
  async getStats(
    @Param('tenantId') tenantId: string,
    @Param('subscriberId') subscriberId: string,
  ) {
    return this.service.getStats(subscriberId, tenantId);
  }

  /**
   * Get unread count
   */
  @Get('unread/:subscriberId')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(
    @Param('tenantId') tenantId: string,
    @Param('subscriberId') subscriberId: string,
  ) {
    const count = await this.service.getUnreadCount(subscriberId, tenantId);
    return { unreadCount: count };
  }

  /**
   * Search notifications
   */
  @Get('search/:subscriberId')
  @ApiOperation({ summary: 'Search notifications' })
  async searchNotifications(
    @Param('tenantId') tenantId: string,
    @Param('subscriberId') subscriberId: string,
    @Query('q') query: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.service.searchNotifications(
      subscriberId,
      tenantId,
      query,
      page,
      limit,
    );
  }

  /**
   * Get notifications by channel
   */
  @Get('channel/:subscriberId/:channel')
  @ApiOperation({ summary: 'Get notifications by channel' })
  async getByChannel(
    @Param('tenantId') tenantId: string,
    @Param('subscriberId') subscriberId: string,
    @Param('channel') channel: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.service.getNotificationsByChannel(
      subscriberId,
      tenantId,
      channel,
      page,
      limit,
    );
  }
}
