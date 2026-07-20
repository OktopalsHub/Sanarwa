import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';
import { NotificationQueueService } from '../queue/notification-queue.service';

@ApiTags('Dead Letter Queue')
@Controller('messaging/dead-letter')
@UseGuards(AuthGuard)
export class DeadLetterController {
  constructor(private readonly queueService: NotificationQueueService) { }

  @Get()
  @ApiOperation({ summary: 'Get dead letter queue items' })
  @ApiResponse({
    status: 200,
    description: 'Dead letter items retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDeadLetterItems(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const items = await this.queueService.getDeadLetterItems(limit);

    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Reprocess a dead letter item' })
  @ApiResponse({
    status: 200,
    description: 'Dead letter item reprocessed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Dead letter item not found' })
  async reprocessDeadLetterItem(@Param('id') id: string) {
    await this.queueService.reprocessDeadLetterItem(id);

    return {
      message: 'Dead letter item reprocessed successfully',
      id,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a dead letter item' })
  @ApiResponse({
    status: 204,
    description: 'Dead letter item deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Dead letter item not found' })
  async deleteDeadLetterItem(@Param('id') id: string) {
    // TODO: Implement deletion of dead letter items
    // This would remove the item from the dead letter queue permanently
    return;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get dead letter queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Dead letter queue statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDeadLetterStats() {
    const items = await this.queueService.getDeadLetterItems(1000);

    const stats = {
      totalItems: items.length,
      byType: items.reduce((acc, item) => {
        acc[item.originalType] = (acc[item.originalType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byTenant: items.reduce((acc, item) => {
        acc[item.tenantId] = (acc[item.tenantId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recentFailures: items
        .sort((a, b) => new Date(b.failedAt).getTime() - new Date(a.failedAt).getTime())
        .slice(0, 10)
        .map(item => ({
          id: item.originalId,
          type: item.originalType,
          failedAt: item.failedAt,
          reason: item.failureReason,
          retryCount: item.retryCount,
        })),
    };

    return stats;
  }

  @Get('failed-jobs')
  @ApiOperation({ summary: 'Get failed jobs from queues' })
  @ApiResponse({
    status: 200,
    description: 'Failed jobs retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getFailedJobs(@Query('limit') limit: number = 50) {
    return this.queueService.getFailedJobs(limit);
  }

  @Get('queue-stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getQueueStats() {
    return this.queueService.getQueueStats();
  }

  @Post('clean-queues')
  @ApiOperation({ summary: 'Clean completed and failed jobs from queues' })
  @ApiResponse({
    status: 200,
    description: 'Queues cleaned successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async cleanQueues() {
    await this.queueService.cleanQueues();

    return {
      message: 'Queues cleaned successfully',
      timestamp: new Date(),
    };
  }

  @Post('pause-queues')
  @ApiOperation({ summary: 'Pause all queues' })
  @ApiResponse({
    status: 200,
    description: 'Queues paused successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async pauseQueues() {
    await this.queueService.pauseQueues();

    return {
      message: 'Queues paused successfully',
      timestamp: new Date(),
    };
  }

  @Post('resume-queues')
  @ApiOperation({ summary: 'Resume all queues' })
  @ApiResponse({
    status: 200,
    description: 'Queues resumed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async resumeQueues() {
    await this.queueService.resumeQueues();

    return {
      message: 'Queues resumed successfully',
      timestamp: new Date(),
    };
  }
}