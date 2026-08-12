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
import { CurrentTenantId } from '../../../common/decorators';
import { TenantMemberGuard } from '../../../common/guards';
import { NotificationCenterService } from '../services/notification-center.service';
import { NotificationCenterStatus } from '../entities/notification-center.entity';

@ApiTags('notifications/center')
@Controller('tenants/:tenantId/notifications/center')
@ApiBearerAuth()
@UseGuards(TenantMemberGuard)
export class NotificationCenterController {
  constructor(private readonly service: NotificationCenterService) {}

  /**
   * Get notification feed for subscriber
   */
  @Get('feed/:subscriberId')
  @ApiOperation({ summary: 'Get notification feed' })
  async getFeed(
    @CurrentTenantId() tenantId: string,
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
  async getNotification(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.getNotification(id, tenantId);
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.markAsRead(id, tenantId);
  }

  /**
   * Mark multiple notifications as read
   */
  @Post('bulk/read')
  @ApiOperation({ summary: 'Mark multiple notifications as read' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async markMultipleAsRead(
    @CurrentTenantId() tenantId: string,
    @Body() body: { ids: string[] },
  ) {
    await this.service.markMultipleAsRead(body.ids ?? [], tenantId);
  }

  /**
   * Mark all notifications as read
   */
  @Post(':subscriberId/read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllAsRead(
    @CurrentTenantId() tenantId: string,
    @Param('subscriberId') subscriberId: string,
  ) {
    await this.service.markAllAsRead(subscriberId, tenantId);
  }

  /**
   * Archive notification
   */
  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive notification' })
  async archiveNotification(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.archiveNotification(id, tenantId);
  }

  /**
   * Archive multiple notifications
   */
  @Post('bulk/archive')
  @ApiOperation({ summary: 'Archive multiple notifications' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async archiveMultiple(
    @CurrentTenantId() tenantId: string,
    @Body() body: { ids: string[] },
  ) {
    await this.service.archiveMultiple(body.ids ?? [], tenantId);
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    await this.service.deleteNotification(id, tenantId);
  }

  /**
   * Delete multiple notifications
   */
  @Post('bulk/delete')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMultiple(
    @CurrentTenantId() tenantId: string,
    @Body() body: { ids: string[] },
  ) {
    await this.service.deleteMultiple(body.ids ?? [], tenantId);
  }

  /**
   * Get notification center statistics
   */
  @Get('stats/:subscriberId')
  @ApiOperation({ summary: 'Get notification center statistics' })
  async getStats(
    @CurrentTenantId() tenantId: string,
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
    @CurrentTenantId() tenantId: string,
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
    @CurrentTenantId() tenantId: string,
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
    @CurrentTenantId() tenantId: string,
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
