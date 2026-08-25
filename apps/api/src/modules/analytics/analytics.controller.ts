import { Body, Get, Param, Post, Query, Controller, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { CurrentTenantId } from "src/common/decorators";
import { TenantContextGuard } from "src/common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";
import { AdvancedAnalyticsService } from "./advanced-analytics.service";
import { DeliveryTrackingService } from "./delivery-tracking.service";
import {
  AnalyticsQueryDto,
  DeliveryStatsQueryDto,
  DeliveryTrendsQueryDto,
  ProviderAnalyticsQueryDto,
  TimeSeriesQueryDto,
} from "./dto/analytics-query.dto";

@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(AuthGuard, TenantContextGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
    private readonly deliveryTrackingService: DeliveryTrackingService,
  ) {}

  /**
   * Get delivery rate analytics
   */
  /**
   * Get delivery rate analytics
   */
  @Get("delivery-rates")
  @ApiOperation({ summary: "Get delivery rate analytics" })
  @ApiResponse({ status: 200, description: "Delivery rates retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @Get("channels")
  @ApiOperation({ summary: "Get channel analytics" })
  @ApiResponse({ status: 200, description: "Channel analytics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @Get("providers")
  @ApiOperation({ summary: "Get provider analytics" })
  @ApiResponse({ status: 200, description: "Provider analytics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @Get("time-series")
  @ApiOperation({ summary: "Get time series analytics data" })
  @ApiResponse({ status: 200, description: "Time series data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getTimeSeriesData(@CurrentTenantId() tenantId: string, @Query() query: TimeSeriesQueryDto) {
    const analyticsQuery = {
      tenantId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      channel: query.channel,
    };

    return this.analyticsService.getTimeSeriesData(analyticsQuery, query.interval);
  }

  /**
   * Get comprehensive tenant analytics
   */
  /**
   * Get comprehensive tenant analytics
   */
  @Get("tenant/:tenantId")
  @ApiOperation({ summary: "Get overall tenant analytics" })
  @ApiParam({ name: "tenantId", description: "Tenant ID" })
  @ApiResponse({ status: 200, description: "Tenant analytics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getTenantAnalytics(
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("dashboard")
  @ApiOperation({ summary: "Get analytics dashboard data" })
  @ApiResponse({ status: 200, description: "Dashboard data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getDashboard(
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("providers/top")
  @ApiOperation({ summary: "Get top performing providers" })
  @ApiResponse({ status: 200, description: "Top providers retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getTopProviders(
    @CurrentTenantId() tenantId: string,
    @Query("limit") limit?: number,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("trends")
  @ApiOperation({ summary: "Get delivery trends comparison" })
  @ApiResponse({ status: 200, description: "Delivery trends retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @Get("delivery-stats")
  @ApiOperation({ summary: "Get delivery statistics" })
  @ApiResponse({ status: 200, description: "Delivery statistics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
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
  @Get("delivery-history/:notificationId")
  @ApiOperation({ summary: "Get delivery history by notification ID" })
  @ApiParam({ name: "notificationId", description: "Notification ID" })
  @ApiResponse({ status: 200, description: "Delivery history retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Notification not found" })
  async getDeliveryHistory(
    @Param("notificationId") notificationId: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.deliveryTrackingService.getDeliveryHistory(notificationId, tenantId);
  }

  /**
   * Get multiple delivery statuses
   */
  /**
   * Get multiple delivery statuses
   */
  @Post("delivery-status/batch")
  @ApiOperation({ summary: "Get batch delivery statuses" })
  @ApiResponse({ status: 200, description: "Batch delivery statuses retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  async getMultipleDeliveryStatus(
    @CurrentTenantId() tenantId: string,
    @Body() body: { notificationIds: string[] },
  ) {
    return this.deliveryTrackingService.getMultipleDeliveryStatus(body.notificationIds, tenantId);
  }
}
