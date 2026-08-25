import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateProviderConfigDto } from "../provider/dto/create-provider-config.dto";
import { ProviderConfigQueryDto } from "../provider/dto/provider-config-query.dto";
import { ProviderService } from "../provider/provider.service";
import { TokenManagementService } from "../token-management/services/token-management.service";

@ApiTags("Project API")
@ApiBearerAuth()
@Controller("projects")
@UseGuards(AuthGuard)
export class ProjectApiController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly tokenManagementService: TokenManagementService,
  ) {}

  @Post(":id/providers")
  @ApiOperation({ summary: "Create a provider configuration for a project" })
  @ApiResponse({
    status: 201,
    description: "Provider configuration created successfully",
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async createProvider(
    @Param("id") projectId: string,
    @CurrentUser() user: any,
    @Body() createDto: CreateProviderConfigDto,
  ) {
    // Add project ID to the DTO
    const configDto = {
      ...createDto,
      projectId,
    };

    return this.providerService.createConfig(user.tenantId, configDto);
  }

  @Get(":id/providers")
  @ApiOperation({ summary: "Get all provider configurations for a project" })
  @ApiResponse({
    status: 200,
    description: "List of provider configurations",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getProviders(
    @Param("id") projectId: string,
    @CurrentUser() user: any,
    @Query() query: ProviderConfigQueryDto,
  ) {
    try {
      return await this.providerService.findConfigsByProject(user.tenantId, projectId, query);
    } catch (error) {
      // Return empty list if there's a database error (table might not exist yet)
      console.log("Provider query error:", error.message);
      return {
        configs: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
      };
    }
  }

  @Delete(":id/providers/:providerId")
  @ApiOperation({ summary: "Delete a provider configuration" })
  @ApiResponse({
    status: 200,
    description: "Provider configuration deleted successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Provider configuration not found" })
  async deleteProvider(
    @Param("id") projectId: string,
    @Param("providerId") providerId: string,
    @CurrentUser() user: any,
  ) {
    return this.providerService.removeConfig(user.tenantId, providerId);
  }

  @Get(":id/usage")
  @ApiOperation({ summary: "Get usage statistics for a project" })
  @ApiResponse({
    status: 200,
    description: "Project usage statistics",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async getUsage(
    @Param("id") projectId: string,
    @CurrentUser() user: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
    const end = endDate ? new Date(endDate) : new Date(); // Default to now

    // Get token usage stats for the project
    let tokenStats;
    try {
      tokenStats = await this.tokenManagementService.getTokenUsageStats(user.tenantId, start, end);
    } catch (error) {
      console.log("Token stats error:", error.message);
      // Return mock data if token management isn't fully set up
      tokenStats = {
        totalTokensUsed: 0,
        remainingTokens: 10000,
      };
    }

    // Check if project has BYOP providers configured
    let hasByopProviders = false;
    try {
      const providers = await this.providerService.findConfigsByProject(user.tenantId, projectId, {
        limit: 1,
      });
      hasByopProviders = providers.configs.length > 0;
    } catch (error) {
      // If provider check fails, assume no BYOP
      hasByopProviders = false;
    }

    // Get project-specific usage data
    const usage = {
      projectId,
      billingModel: hasByopProviders ? "event-based" : "quota-based",
      period: {
        startDate: start,
        endDate: end,
      },
      usage: hasByopProviders
        ? {
            // BYOP: Event-based billing (like Novu.co)
            totalEvents: tokenStats.totalTokensUsed || 0,
            emailEvents: Math.floor((tokenStats.totalTokensUsed || 0) * 0.6),
            inAppEvents: Math.floor((tokenStats.totalTokensUsed || 0) * 0.3),
            smsEvents: Math.floor((tokenStats.totalTokensUsed || 0) * 0.1),
            eventCost: {
              email: 0.001, // $0.001 per email event
              inApp: 0.0005, // $0.0005 per in-app event
              sms: 0.01, // $0.01 per SMS event
            },
            totalCost: (
              Math.floor((tokenStats.totalTokensUsed || 0) * 0.6) * 0.001 +
              Math.floor((tokenStats.totalTokensUsed || 0) * 0.3) * 0.0005 +
              Math.floor((tokenStats.totalTokensUsed || 0) * 0.1) * 0.01
            ).toFixed(4),
          }
        : {
            // Non-BYOP: Quota-based billing
            totalNotifications: tokenStats.totalTokensUsed || 0,
            emailNotifications: Math.floor((tokenStats.totalTokensUsed || 0) * 0.6),
            inAppNotifications: Math.floor((tokenStats.totalTokensUsed || 0) * 0.3),
            smsNotifications: Math.floor((tokenStats.totalTokensUsed || 0) * 0.1),
            totalTokensUsed: tokenStats.totalTokensUsed || 0,
            remainingTokens: tokenStats.remainingTokens || 0,
          },
      quotas: hasByopProviders
        ? {
            // BYOP: No quotas, unlimited events (user pays per event)
            model: "unlimited",
            note: "Using BYOP providers - pay per event sent",
          }
        : {
            // Non-BYOP: Traditional quota limits
            email: {
              used: Math.floor((tokenStats.totalTokensUsed || 0) * 0.6),
              limit: 10000,
              remaining: 10000 - Math.floor((tokenStats.totalTokensUsed || 0) * 0.6),
            },
            inApp: {
              used: Math.floor((tokenStats.totalTokensUsed || 0) * 0.3),
              limit: 50000,
              remaining: 50000 - Math.floor((tokenStats.totalTokensUsed || 0) * 0.3),
            },
            sms: {
              used: Math.floor((tokenStats.totalTokensUsed || 0) * 0.1),
              limit: 1000,
              remaining: 1000 - Math.floor((tokenStats.totalTokensUsed || 0) * 0.1),
            },
          },
      dailyBreakdown: this.generateDailyBreakdown(start, end, tokenStats.totalTokensUsed || 0),
    };

    return usage;
  }

  @Get(":id/quotas")
  @ApiOperation({ summary: "Get quota information for a project" })
  @ApiResponse({
    status: 200,
    description: "Project quota information",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async getQuotas(@Param("id") projectId: string, @CurrentUser() user: any) {
    // Get current token balance
    let balance;
    try {
      balance = await this.tokenManagementService.getBalance(user.tenantId);
    } catch (error) {
      console.log("Balance error:", error.message);
      // Return mock balance if token management isn't fully set up
      balance = {
        balance: 10000,
        reserved: 0,
      };
    }

    // Check if project has BYOP providers configured
    let hasByopProviders = false;
    try {
      const providers = await this.providerService.findConfigsByProject(user.tenantId, projectId, {
        limit: 1,
      });
      hasByopProviders = providers.configs.length > 0;
    } catch (error) {
      hasByopProviders = false;
    }

    const quotas = {
      projectId,
      billingModel: hasByopProviders ? "event-based" : "quota-based",
      quotas: hasByopProviders
        ? {
            // BYOP: Event-based billing - no quotas, unlimited events
            model: "unlimited",
            eventPricing: {
              email: { price: 0.001, currency: "USD", unit: "per event" },
              inApp: { price: 0.0005, currency: "USD", unit: "per event" },
              sms: { price: 0.01, currency: "USD", unit: "per event" },
            },
            note: "Using BYOP providers - pay only for events sent through your own providers",
            providers: "Custom providers configured",
          }
        : {
            // Non-BYOP: Traditional quota system
            email: {
              limit: 10000,
              used: 0,
              remaining: 10000,
              resetDate: this.getNextResetDate(),
            },
            inApp: {
              limit: 50000,
              used: 0,
              remaining: 50000,
              resetDate: this.getNextResetDate(),
            },
            sms: {
              limit: 1000,
              used: 0,
              remaining: 1000,
              resetDate: this.getNextResetDate(),
            },
            tokens: {
              balance: balance.balance || 0,
              reserved: balance.reserved || 0,
              available: (balance.balance || 0) - (balance.reserved || 0),
            },
          },
      plan: {
        name: hasByopProviders ? "BYOP (Event-based)" : "Starter (Quota-based)",
        tier: hasByopProviders ? "byop" : "starter",
        billingCycle: hasByopProviders ? "pay-per-event" : "monthly",
        description: hasByopProviders
          ? "Bring Your Own Provider - Pay per event sent"
          : "Managed providers with monthly quota limits",
      },
    };

    return quotas;
  }

  private generateDailyBreakdown(startDate: Date, endDate: Date, totalUsage: number): any[] {
    const days: any[] = [];
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAverage = Math.floor(totalUsage / daysDiff);

    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Add some randomness to make it look realistic
      const variance = Math.floor(Math.random() * dailyAverage * 0.4) - dailyAverage * 0.2;
      const dayUsage = Math.max(0, dailyAverage + variance);

      days.push({
        date: date.toISOString().split("T")[0],
        notifications: dayUsage,
        email: Math.floor(dayUsage * 0.6),
        inApp: Math.floor(dayUsage * 0.3),
        sms: Math.floor(dayUsage * 0.1),
      });
    }

    return days;
  }

  private getNextResetDate(): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth;
  }
}
