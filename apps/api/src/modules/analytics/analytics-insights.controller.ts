import { Get, Param, Query, Controller, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { CurrentTenantId } from "src/common/decorators";
import { TenantContextGuard } from "src/common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdvancedAnalyticsService } from "./advanced-analytics.service";
import { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(AuthGuard, TenantContextGuard)
export class AnalyticsInsightsController {
  constructor(
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Get analytics filtered by project
   */
  /**
   * Get analytics filtered by project
   */
  @Get("project/:projectId")
  @ApiOperation({ summary: "Get project analytics" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 200, description: "Project analytics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async getProjectAnalytics(
    @Param("projectId") projectId: string,
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("brand/:brandId")
  @ApiOperation({ summary: "Get brand analytics" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Brand analytics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Brand not found" })
  async getBrandAnalytics(
    @Param("brandId") brandId: string,
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("compare/projects")
  @ApiOperation({ summary: "Compare project analytics" })
  @ApiResponse({ status: 200, description: "Comparison data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async compareProjects(
    @CurrentTenantId() tenantId: string,
    @Query("projectIds") projectIds: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const projectIdArray = projectIds.split(",");
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
  @Get("compare/brands")
  @ApiOperation({ summary: "Compare brand analytics" })
  @ApiResponse({ status: 200, description: "Comparison data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async compareBrands(
    @CurrentTenantId() tenantId: string,
    @Query("brandIds") brandIds: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const brandIdArray = brandIds.split(",");
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
  @Get("advanced/cohorts")
  @ApiOperation({ summary: "Get cohort analysis" })
  @ApiResponse({ status: 200, description: "Cohort analysis data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getCohortAnalysis(
    @CurrentTenantId() tenantId: string,
    @Query("cohortType") cohortType?: "weekly" | "monthly",
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("advanced/user-journey/:userIdentifier")
  @ApiOperation({ summary: "Get user journey analysis" })
  @ApiParam({ name: "userIdentifier", description: "User Identifier" })
  @ApiResponse({ status: 200, description: "User journey data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "User not found" })
  async getUserJourney(
    @Param("userIdentifier") userIdentifier: string,
    @CurrentTenantId() tenantId: string,
    @Query("limit") limit?: number,
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
  @Get("advanced/optimal-send-times")
  @ApiOperation({ summary: "Get optimal send times prediction" })
  @ApiResponse({ status: 200, description: "Optimal send times data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getOptimalSendTimes(
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
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
  @Get("advanced/churn-risk")
  @ApiOperation({ summary: "Get churn risk analysis" })
  @ApiResponse({ status: 200, description: "Churn risk data retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getChurnRiskAnalysis(@CurrentTenantId() tenantId: string) {
    return this.advancedAnalyticsService.getChurnRiskAnalysis(tenantId);
  }
}
