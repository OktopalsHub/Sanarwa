import {
  Body,
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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantId } from 'src/common/decorators';
import { TenantContextGuard } from 'src/common/guards';
import { AuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessageChannel as NotificationChannel } from '../messaging/message.entity';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { AnalyticsService } from './analytics.service';
import { AuditLogService } from './audit-log.service';
import { DeliveryTrackingService } from './delivery-tracking.service';
import {
  AnalyticsQueryDto,
  DeliveryStatsQueryDto,
  DeliveryTrendsQueryDto,
  ProviderAnalyticsQueryDto,
  TimeSeriesQueryDto,
} from './dto/analytics-query.dto';
import { AuditExportDto, AuditQueryDto } from './dto/audit-query.dto';
import { RegisterWebhookDto } from './dto/webhook-config.dto';
import { PerformanceMetricsService } from './performance-metrics.service';
import { WebhookService } from './webhook.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(AuthGuard, TenantContextGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
    private readonly deliveryTrackingService: DeliveryTrackingService,
    private readonly webhookService: WebhookService,
    private readonly auditLogService: AuditLogService,
    private readonly performanceMetricsService: PerformanceMetricsService,
  ) { }

  /**
   * Get delivery rate analytics
   */
  /**
   * Get delivery rate analytics
   */
  @Get('delivery-rates')
  @ApiOperation({ summary: 'Get delivery rate analytics' })
  @ApiResponse({ status: 200, description: 'Delivery rates retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDeliveryRateAnalytics(
    @CurrentTenantId() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    const analyticsQuery = {
      tenantId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      channel: query.channel,
      status: query.status,
      priority: query.priority,
    };

    return this.analyticsService.getDeliveryRateAnalytics(analyticsQuery);
  }

  /**
   * Get channel analytics
   */
  /**
   * Get channel analytics
   */
  @Get('channels')
  @ApiOperation({ summary: 'Get channel analytics' })
  @ApiResponse({ status: 200, description: 'Channel analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getChannelAnalytics(
    @CurrentTenantId() tenantId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    const analyticsQuery = {
      tenantId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    return this.analyticsService.getChannelAnalytics(analyticsQuery);
  }

  /**
   * Get provider analytics
   */
  /**
   * Get provider analytics
   */
  @Get('providers')
  @ApiOperation({ summary: 'Get provider analytics' })
  @ApiResponse({ status: 200, description: 'Provider analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProviderAnalytics(
    @CurrentTenantId() tenantId: string,
    @Query() query: ProviderAnalyticsQueryDto,
  ) {
    const analyticsQuery = {
      tenantId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      channel: query.channel,
    };

    return this.analyticsService.getProviderAnalytics(analyticsQuery);
  }

  /**
   * Get time series data
   */
  /**
   * Get time series data
   */
  @Get('time-series')
  @ApiOperation({ summary: 'Get time series analytics data' })
  @ApiResponse({ status: 200, description: 'Time series data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTimeSeriesData(
    @CurrentTenantId() tenantId: string,
    @Query() query: TimeSeriesQueryDto,
  ) {
    const analyticsQuery = {
      tenantId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      channel: query.channel,
    };

    return this.analyticsService.getTimeSeriesData(
      analyticsQuery,
      query.interval,
    );
  }

  /**
   * Get comprehensive tenant analytics
   */
  /**
   * Get comprehensive tenant analytics
   */
  @Get('tenant/:tenantId')
  @ApiOperation({ summary: 'Get overall tenant analytics' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTenantAnalytics(
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTenantAnalytics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get analytics dashboard for current tenant
   */
  /**
   * Get analytics dashboard for current tenant
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDashboard(
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTenantAnalytics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get top performing providers
   */
  /**
   * Get top performing providers
   */
  @Get('providers/top')
  @ApiOperation({ summary: 'Get top performing providers' })
  @ApiResponse({ status: 200, description: 'Top providers retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTopProviders(
    @CurrentTenantId() tenantId: string,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getTopProviders(
      tenantId,
      limit ? parseInt(limit.toString()) : 10,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get delivery trends comparison
   */
  /**
   * Get delivery trends comparison
   */
  @Get('trends')
  @ApiOperation({ summary: 'Get delivery trends comparison' })
  @ApiResponse({ status: 200, description: 'Delivery trends retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDeliveryTrends(
    @CurrentTenantId() tenantId: string,
    @Query() query: DeliveryTrendsQueryDto,
  ) {
    return this.analyticsService.getDeliveryTrends(
      tenantId,
      new Date(query.currentPeriodStart),
      new Date(query.currentPeriodEnd),
      new Date(query.previousPeriodStart),
      new Date(query.previousPeriodEnd),
    );
  }

  /**
   * Get delivery statistics
   */
  /**
   * Get delivery statistics
   */
  @Get('delivery-stats')
  @ApiOperation({ summary: 'Get delivery statistics' })
  @ApiResponse({ status: 200, description: 'Delivery statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDeliveryStats(
    @CurrentTenantId() tenantId: string,
    @Query() query: DeliveryStatsQueryDto,
  ) {
    return this.deliveryTrackingService.getDeliveryStats(
      tenantId,
      query.channel,
      query.startDate ? new Date(query.startDate) : undefined,
      query.endDate ? new Date(query.endDate) : undefined,
    );
  }

  /**
   * Get delivery history for a notification
   */
  /**
   * Get delivery history for a notification
   */
  @Get('delivery-history/:notificationId')
  @ApiOperation({ summary: 'Get delivery history by notification ID' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Delivery history retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getDeliveryHistory(
    @Param('notificationId') notificationId: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.deliveryTrackingService.getDeliveryHistory(
      notificationId,
      tenantId,
    );
  }

  /**
   * Get multiple delivery statuses
   */
  /**
   * Get multiple delivery statuses
   */
  @Post('delivery-status/batch')
  @ApiOperation({ summary: 'Get batch delivery statuses' })
  @ApiResponse({ status: 200, description: 'Batch delivery statuses retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getMultipleDeliveryStatus(
    @CurrentTenantId() tenantId: string,
    @Body() body: { notificationIds: string[] },
  ) {
    return this.deliveryTrackingService.getMultipleDeliveryStatus(
      body.notificationIds,
      tenantId,
    );
  }

  /**
   * Register webhook configuration
   */
  /**
   * Register webhook configuration
   */
  @Post('webhooks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async registerWebhook(
    @CurrentTenantId() tenantId: string,
    @Body() dto: RegisterWebhookDto,
  ) {
    const config = {
      url: dto.url,
      secret: dto.secret,
      headers: dto.headers,
      retryAttempts: dto.retryAttempts,
      timeout: dto.timeout,
    };

    this.webhookService.registerWebhook(tenantId, config);

    return {
      message: 'Webhook registered successfully',
      tenantId,
      url: dto.url,
    };
  }

  /**
   * Remove webhook configuration
   */
  /**
   * Remove webhook configuration
   */
  @Delete('webhooks/:tenantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove webhook configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 204, description: 'Webhook removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook configuration not found' })
  async removeWebhook(@CurrentTenantId() tenantId: string) {
    this.webhookService.removeWebhook(tenantId);
  }

  /**
   * Test webhook configuration
   */
  /**
   * Test webhook configuration
   */
  @Post('webhooks/:tenantId/test')
  @ApiOperation({ summary: 'Test webhook configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Webhook test executed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Webhook configuration not found' })
  async testWebhook(@CurrentTenantId() tenantId: string) {
    const success = await this.webhookService.testWebhook(tenantId);
    return {
      success,
      message: success ? 'Webhook test successful' : 'Webhook test failed',
    };
  }

  /**
   * Get webhook configuration
   */
  /**
   * Get webhook configuration
   */
  @Get('webhooks/:tenantId')
  @ApiOperation({ summary: 'Get webhook configuration' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Webhook configuration retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWebhookConfig(@CurrentTenantId() tenantId: string) {
    const config = this.webhookService.getWebhookConfig(tenantId);
    if (!config) {
      return { configured: false };
    }

    return {
      configured: true,
      url: config.url,
      retryAttempts: config.retryAttempts,
      timeout: config.timeout,
      // Don't expose secret or headers for security
    };
  }

  /**
   * Get audit logs
   */
  /**
   * Get audit logs
   */
  @Get('audit-logs')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAuditLogs(
    @CurrentTenantId() tenantId: string,
    @Query() query: AuditQueryDto,
  ) {
    const auditQuery = {
      tenantId,
      eventType: query.eventType,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      userId: query.userId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    return this.auditLogService.getAuditLogs(auditQuery);
  }

  /**
   * Get audit trail for a notification
   */
  /**
   * Get audit trail for a notification
   */
  @Get('audit-logs/notification/:notificationId')
  @ApiOperation({ summary: 'Get notification audit trail' })
  @ApiParam({ name: 'notificationId', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotificationAuditTrail(
    @Param('notificationId') notificationId: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.auditLogService.getNotificationAuditTrail(
      notificationId,
      tenantId,
    );
  }

  /**
   * Get audit statistics
   */
  /**
   * Get audit statistics
   */
  @Get('audit-logs/statistics')
  @ApiOperation({ summary: 'Get audit statistics' })
  @ApiResponse({ status: 200, description: 'Audit statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAuditStatistics(
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditLogService.getAuditStatistics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Export audit logs
   */
  /**
   * Export audit logs
   */
  @Get('audit-logs/export')
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs exported successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async exportAuditLogs(
    @CurrentTenantId() tenantId: string,
    @Query() query: AuditExportDto,
  ) {
    const auditQuery = {
      tenantId,
      eventType: query.eventType,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      userId: query.userId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    const exportData = await this.auditLogService.exportAuditLogs(
      auditQuery,
      query.format,
    );

    return {
      format: query.format,
      data: exportData,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Get system performance metrics
   */
  /**
   * Get system performance metrics
   */
  @Get('performance/system')
  @ApiOperation({ summary: 'Get system performance metrics' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSystemPerformanceMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.performanceMetricsService.getSystemPerformanceMetrics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get provider performance metrics
   */
  /**
   * Get provider performance metrics
   */
  @Get('performance/providers')
  @ApiOperation({ summary: 'Get provider performance metrics' })
  @ApiResponse({ status: 200, description: 'Provider metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProviderPerformanceMetrics(
    @Query('providerId') providerId?: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.performanceMetricsService.getProviderPerformanceMetrics(
      providerId,
      channel,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get tenant performance metrics
   */
  /**
   * Get tenant performance metrics
   */
  @Get('performance/tenant/:tenantId')
  @ApiOperation({ summary: 'Get tenant performance metrics' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTenantPerformanceMetrics(
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.performanceMetricsService.getTenantPerformanceMetrics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get performance trends
   */
  /**
   * Get performance trends
   */
  @Get('performance/trends')
  @ApiOperation({ summary: 'Get performance trends' })
  @ApiResponse({ status: 200, description: 'Performance trends retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPerformanceTrends(
    @Query('metricName') metricName: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval?: 'hour' | 'day',
  ) {
    return this.performanceMetricsService.getPerformanceTrends(
      metricName,
      new Date(startDate),
      new Date(endDate),
      interval,
    );
  }

  /**
   * Get real-time metrics
   */
  /**
   * Get real-time metrics
   */
  @Get('performance/realtime')
  @ApiOperation({ summary: 'Get real-time performance metrics' })
  @ApiResponse({ status: 200, description: 'Real-time metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRealTimeMetrics() {
    return this.performanceMetricsService.getRealTimeMetrics();
  }

  /**
   * Get analytics filtered by project
   */
  /**
   * Get analytics filtered by project
   */
  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get project analytics' })
  @ApiParam({
    name: 'projectId',
    description: 'Project unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({ status: 200, description: 'Project analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectAnalytics(
    @Param('projectId') projectId: string,
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getProjectAnalytics(
      tenantId,
      projectId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get analytics filtered by brand
   */
  /**
   * Get analytics filtered by brand
   */
  @Get('brand/:brandId')
  @ApiOperation({ summary: 'Get brand analytics' })
  @ApiParam({ name: 'brandId', description: 'Brand ID' })
  @ApiResponse({ status: 200, description: 'Brand analytics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Brand not found' })
  async getBrandAnalytics(
    @Param('brandId') brandId: string,
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getBrandAnalytics(
      tenantId,
      brandId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get comparative analytics between projects
   */
  /**
   * Get comparative analytics between projects
   */
  @Get('compare/projects')
  @ApiOperation({ summary: 'Compare project analytics' })
  @ApiResponse({ status: 200, description: 'Comparison data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async compareProjects(
    @CurrentTenantId() tenantId: string,
    @Query('projectIds') projectIds: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const projectIdArray = projectIds.split(',');
    return this.analyticsService.compareProjects(
      tenantId,
      projectIdArray,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get comparative analytics between brands
   */
  /**
   * Get comparative analytics between brands
   */
  @Get('compare/brands')
  @ApiOperation({ summary: 'Compare brand analytics' })
  @ApiResponse({ status: 200, description: 'Comparison data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async compareBrands(
    @CurrentTenantId() tenantId: string,
    @Query('brandIds') brandIds: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const brandIdArray = brandIds.split(',');
    return this.analyticsService.compareBrands(
      tenantId,
      brandIdArray,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ===== ADVANCED ANALYTICS ENDPOINTS =====

  /**
   * Get cohort analysis for user engagement
   */
  /**
   * Get cohort analysis for user engagement
   */
  @Get('advanced/cohorts')
  @ApiOperation({ summary: 'Get cohort analysis' })
  @ApiResponse({ status: 200, description: 'Cohort analysis data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCohortAnalysis(
    @CurrentTenantId() tenantId: string,
    @Query('cohortType') cohortType?: 'weekly' | 'monthly',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query = {
      tenantId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.advancedAnalyticsService.getCohortAnalysis(query, cohortType);
  }

  /**
   * Get user journey analysis
   */
  /**
   * Get user journey analysis
   */
  @Get('advanced/user-journey/:userIdentifier')
  @ApiOperation({ summary: 'Get user journey analysis' })
  @ApiParam({ name: 'userIdentifier', description: 'User Identifier' })
  @ApiResponse({ status: 200, description: 'User journey data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserJourney(
    @Param('userIdentifier') userIdentifier: string,
    @CurrentTenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.advancedAnalyticsService.getUserJourney(
      tenantId,
      userIdentifier,
      limit ? parseInt(limit.toString()) : 50,
    );
  }

  /**
   * Get optimal send times prediction
   */
  /**
   * Get optimal send times prediction
   */
  @Get('advanced/optimal-send-times')
  @ApiOperation({ summary: 'Get optimal send times prediction' })
  @ApiResponse({ status: 200, description: 'Optimal send times data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOptimalSendTimes(
    @CurrentTenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query = {
      tenantId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    return this.advancedAnalyticsService.getOptimalSendTimes(query);
  }

  /**
   * Get revenue attribution analysis
   */
  // @Get('advanced/revenue-attribution')
  // async getRevenueAttribution(
  //   @Query('tenantId') tenantId: string,
  //   @Query('startDate') startDate?: string,
  //   @Query('endDate') endDate?: string,
  //   @Query('campaignId') campaignId?: string,
  // ) {
  //   const query = {
  //     tenantId,
  //     startDate: startDate ? new Date(startDate) : undefined,
  //     endDate: endDate ? new Date(endDate) : undefined,
  //     campaignId,
  //   };

  //   return this.advancedAnalyticsService.getRevenueAttribution(query);
  // }

  /**
   * Get segment performance analytics
   */
  // @Get('advanced/segment-performance')
  // async getSegmentPerformance(
  //   @Query('tenantId') tenantId: string,
  //   @Query('startDate') startDate?: string,
  //   @Query('endDate') endDate?: string,
  // ) {
  //   const query = {
  //     tenantId,
  //     startDate: startDate ? new Date(startDate) : undefined,
  //     endDate: endDate ? new Date(endDate) : undefined,
  //   };

  //   return this.advancedAnalyticsService.getSegmentPerformance(query);
  // }

  /**
   * Get churn risk analysis
   */
  /**
   * Get churn risk analysis
   */
  @Get('advanced/churn-risk')
  @ApiOperation({ summary: 'Get churn risk analysis' })
  @ApiResponse({ status: 200, description: 'Churn risk data retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getChurnRiskAnalysis(@CurrentTenantId() tenantId: string) {
    return this.advancedAnalyticsService.getChurnRiskAnalysis(tenantId);
  }
}
