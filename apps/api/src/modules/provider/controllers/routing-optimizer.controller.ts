import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RoutingOptimizerService } from "../services/routing-optimizer.service";

@ApiTags("Routing Optimizer")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("routing-optimizer")
export class RoutingOptimizerController {
  constructor(private readonly optimizerService: RoutingOptimizerService) {}

  /**
   * Analyze routing performance and get optimization recommendations
   */
  @Get("analyze")
  @ApiOperation({ summary: "Analyze routing performance and get optimization recommendations" })
  @ApiResponse({ status: 200, description: "Analysis results retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async analyzeRouting() {
    return this.optimizerService.analyzeAndOptimize();
  }

  /**
   * Get optimized provider recommendation
   */
  @Get("optimize")
  @ApiOperation({ summary: "Get optimized provider recommendation" })
  @ApiResponse({ status: 200, description: "Optimization recommendation retrieved successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getOptimizedProvider(
    @Query("channel") channel: string,
    @Query("region") region: string,
    @Query("priority") priority?: string,
  ) {
    return this.optimizerService.getOptimizedProvider(channel, region, priority);
  }

  /**
   * Predict optimal provider using ML-based approach
   */
  @Get("predict")
  @ApiOperation({ summary: "Predict optimal provider using ML-based approach" })
  @ApiResponse({ status: 200, description: "Prediction retrieved successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async predictOptimalProvider(
    @Query("channel") channel: string,
    @Query("region") region: string,
    @Query("timeOfDay") timeOfDay: number,
    @Query("messageVolume") messageVolume: number,
  ) {
    return this.optimizerService.predictOptimalProvider(channel, region, timeOfDay, messageVolume);
  }

  /**
   * Start A/B testing for routing optimization
   */
  @Post("ab-test")
  @ApiOperation({ summary: "Start A/B testing for routing optimization" })
  @ApiResponse({ status: 201, description: "A/B test started successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async startABTest(
    @Body() body: { channel: string; region: string; providers: string[]; durationHours?: number },
  ) {
    const { channel, region, providers, durationHours } = body;
    const testId = await this.optimizerService.startABTest(
      channel,
      region,
      providers,
      durationHours,
    );
    return { testId, status: "started" };
  }

  /**
   * Get A/B test results
   */
  @Get("ab-test/:testId")
  @ApiOperation({ summary: "Get A/B test results" })
  @ApiResponse({ status: 200, description: "Test results retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Test not found" })
  async getABTestResults(@Query("testId") testId: string) {
    return this.optimizerService.getABTestResults(testId);
  }

  /**
   * Update routing metrics (called by notification processing pipeline)
   */
  @Post("metrics")
  @ApiOperation({ summary: "Update routing metrics (called by notification processing pipeline)" })
  @ApiResponse({ status: 201, description: "Metrics updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async updateMetrics(
    @Body() body: { channel: string; provider: string; success: boolean; latency: number },
  ) {
    const { channel, provider, success, latency } = body;
    await this.optimizerService.updateMetrics(channel, provider, success, latency);
    return { status: "updated" };
  }
}
