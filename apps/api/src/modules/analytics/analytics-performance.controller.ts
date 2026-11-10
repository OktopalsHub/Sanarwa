import { Get, Query, Controller, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { CurrentTenantId } from "../../common/decorators";
import { TenantContextGuard } from "../../common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { PerformanceMetricsService } from "./performance-metrics.service";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";

@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(AuthGuard, TenantContextGuard)
export class AnalyticsPerformanceController {
  constructor(private readonly performanceMetricsService: PerformanceMetricsService) {}

  @Get("performance/system")
  @ApiOperation({ summary: "Get system performance metrics" })
  @ApiResponse({ status: 200, description: "System metrics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSystemPerformanceMetrics(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.performanceMetricsService.getSystemPerformanceMetrics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("performance/providers")
  @ApiOperation({ summary: "Get provider performance metrics" })
  @ApiResponse({ status: 200, description: "Provider metrics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProviderPerformanceMetrics(
    @Query("providerId") providerId?: string,
    @Query("channel") channel?: NotificationChannel,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.performanceMetricsService.getProviderPerformanceMetrics(
      providerId,
      channel,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("performance/tenant/:tenantId")
  @ApiOperation({ summary: "Get tenant performance metrics" })
  @ApiParam({ name: "tenantId", description: "Tenant ID" })
  @ApiResponse({ status: 200, description: "Tenant metrics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getTenantPerformanceMetrics(
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.performanceMetricsService.getTenantPerformanceMetrics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("performance/trends")
  @ApiOperation({ summary: "Get performance trends" })
  @ApiResponse({ status: 200, description: "Performance trends retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPerformanceTrends(
    @Query("metricName") metricName: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("interval") interval?: "hour" | "day",
  ) {
    return this.performanceMetricsService.getPerformanceTrends(
      metricName,
      new Date(startDate),
      new Date(endDate),
      interval,
    );
  }

  @Get("performance/realtime")
  @ApiOperation({ summary: "Get real-time performance metrics" })
  @ApiResponse({ status: 200, description: "Real-time metrics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getRealTimeMetrics() {
    return this.performanceMetricsService.getRealTimeMetrics();
  }
}
