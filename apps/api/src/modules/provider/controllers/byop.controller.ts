import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantId } from '../../../common/decorators';
import { NotificationChannel } from '../../../common/enums/notification-channel.enum';
import { ProviderService } from '../provider.service';
import { ProviderCostTrackerService } from '../services/provider-cost-tracker.service';
import { ProviderTemplateService } from '../services/provider-template.service';

@ApiTags('byop')
@Controller('tenants/:tenantId/projects/:projectId/byop')
export class BYOPController {
  constructor(
    private readonly providerTemplateService: ProviderTemplateService,
    private readonly costTrackerService: ProviderCostTrackerService,
    private readonly providerService: ProviderService
  ) { }

  @Get('templates')
  @ApiOperation({ summary: 'Get available provider templates' })
  @ApiResponse({
    status: 200,
    description: 'Provider templates retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTemplates(
    @Query('channel') channel?: NotificationChannel,
    @Query('search') search?: string,
    @Query('popular') popular?: boolean
  ) {
    if (search) {
      return this.providerTemplateService.searchTemplates(search, channel);
    }

    if (popular) {
      return this.providerTemplateService.getPopularTemplates(channel);
    }

    return this.providerTemplateService.getTemplates(channel);
  }

  @Get('templates/:templateId')
  @ApiOperation({ summary: 'Get a specific provider template' })
  @ApiResponse({ status: 200, description: 'Provider template retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplate(@Param('templateId') templateId: string) {
    const template = this.providerTemplateService.getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }
    return template;
  }

  @Post('templates/:templateId/validate')
  @ApiOperation({ summary: 'Validate configuration against template' })
  @ApiResponse({ status: 200, description: 'Configuration validation result' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async validateTemplate(
    @Param('templateId') templateId: string,
    @Body() config: Record<string, any>
  ) {
    return this.providerTemplateService.validateConfiguration(templateId, config);
  }

  @Get('templates/:templateId/hints')
  @ApiOperation({ summary: 'Get configuration hints for template' })
  @ApiResponse({ status: 200, description: 'Configuration hints retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getConfigurationHints(@Param('templateId') templateId: string) {
    return this.providerTemplateService.getConfigurationHints(templateId);
  }

  @Post('recommendations')
  @ApiOperation({ summary: 'Get provider recommendations based on requirements' })
  @ApiResponse({ status: 200, description: 'Recommendations retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getRecommendations(
    @Body() requirements: {
      channel: NotificationChannel;
      region?: string;
      budget?: number;
      volume?: number;
      features?: string[];
    }
  ) {
    return this.providerTemplateService.getRecommendedTemplates(requirements);
  }

  @Get('analytics/costs')
  @ApiOperation({ summary: 'Get cost analytics and trends' })
  @ApiResponse({ status: 200, description: 'Cost analytics retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCostAnalytics(
    @CurrentTenantId() tenantId: string,
    @Query('channel') channel?: NotificationChannel,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity: 'hour' | 'day' | 'week' | 'month' = 'day'
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const trends = await this.costTrackerService.getCostTrends(
      tenantId,
      channel,
      start,
      end,
      granularity
    );

    return { trends, period: { start, end }, granularity };
  }

  @Get('analytics/comparison')
  @ApiOperation({ summary: 'Compare costs between providers' })
  @ApiResponse({ status: 200, description: 'Cost comparison retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async compareProviderCosts(
    @CurrentTenantId() tenantId: string,
    @Query('channel') channel: NotificationChannel,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costTrackerService.compareProviderCosts(tenantId, channel, start, end);
  }

  @Get('analytics/alerts')
  @ApiOperation({ summary: 'Check for cost alerts' })
  @ApiResponse({ status: 200, description: 'Cost alerts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCostAlerts(
    @CurrentTenantId() tenantId: string,
    @Query('dailyLimit') dailyLimit?: number,
    @Query('monthlyLimit') monthlyLimit?: number,
    @Query('spikeThreshold') spikeThreshold?: number
  ) {
    return this.costTrackerService.checkCostAlerts(tenantId, {
      dailyLimit,
      monthlyLimit,
      spikeThreshold
    });
  }

  @Get('analytics/optimization')
  @ApiOperation({ summary: 'Get cost optimization recommendations' })
  @ApiResponse({ status: 200, description: 'Optimization recommendations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getCostOptimization(
    @CurrentTenantId() tenantId: string,
    @Query('channel') channel?: NotificationChannel
  ) {
    return this.costTrackerService.getCostOptimizationRecommendations(tenantId, channel);
  }

  @Get('providers/:providerId/usage')
  @ApiOperation({ summary: 'Get usage metrics for a specific provider' })
  @ApiResponse({ status: 200, description: 'Usage metrics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async getProviderUsage(
    @CurrentTenantId() tenantId: string,
    @Param('providerId') providerId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.costTrackerService.getUsageMetrics(providerId, start, end);
  }

  @Post('calculate-cost')
  @ApiOperation({ summary: 'Calculate estimated costs for given usage' })
  @ApiResponse({ status: 200, description: 'Estimated costs calculated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async calculateCost(
    @Body() request: {
      templateId: string;
      messageCount: number;
      metadata?: Record<string, any>;
    }
  ) {
    const template = this.providerTemplateService.getTemplate(request.templateId);
    if (!template || !template.costModel) {
      throw new Error('Template or cost model not found');
    }

    return this.costTrackerService.calculateCost(
      template.costModel,
      request.messageCount,
      request.metadata
    );
  }

  @Get('health/overview')
  @ApiOperation({ summary: 'Get BYOP system health overview' })
  @ApiResponse({ status: 200, description: 'Health overview retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getHealthOverview(@CurrentTenantId() tenantId: string) {
    // Get all active providers
    const providers = await this.providerService.findAllConfigs(tenantId, { isActive: true });

    const healthChecks = await Promise.all(
      providers.configs.map(async (config) => {
        try {
          const health = await this.providerService.checkProviderHealth(tenantId, config.id);
          return {
            providerId: config.providerId,
            providerName: config.providerName,
            channel: config.channel,
            status: health.status,
            lastCheck: health.lastCheck,
            responseTime: health.responseTime
          };
        } catch (error) {
          return {
            providerId: config.providerId,
            providerName: config.providerName,
            channel: config.channel,
            status: 'unhealthy',
            error: error.message
          };
        }
      })
    );

    const totalProviders = healthChecks.length;
    const healthyProviders = healthChecks.filter(h => h.status === 'healthy').length;
    const unhealthyProviders = healthChecks.filter(h => h.status === 'unhealthy').length;

    return {
      summary: {
        totalProviders,
        healthyProviders,
        unhealthyProviders,
        healthPercentage: totalProviders > 0 ? (healthyProviders / totalProviders) * 100 : 0
      },
      providers: healthChecks
    };
  }

  @Get('setup-guide/:channel')
  @ApiOperation({ summary: 'Get setup guide for a specific channel' })
  @ApiResponse({ status: 200, description: 'Setup guide retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSetupGuide(@Param('channel') channel: NotificationChannel) {
    const templates = this.providerTemplateService.getTemplates(channel);

    return {
      channel,
      availableProviders: templates.length,
      popularProviders: templates.filter(t => t.isPopular),
      easySetupProviders: templates.filter(t => t.difficulty === 'easy'),
      setupSteps: [
        'Choose a provider based on your needs',
        'Create an account with the provider',
        'Obtain API credentials',
        'Configure the provider in your dashboard',
        'Test the configuration',
        'Go live!'
      ],
      considerations: [
        'Cost per message',
        'Delivery reliability',
        'Geographic coverage',
        'Feature support',
        'Setup complexity'
      ]
    };
  }

  @Post('bulk-setup')
  @ApiOperation({ summary: 'Set up multiple providers at once' })
  @ApiResponse({ status: 201, description: 'Bulk setup completed' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @HttpCode(HttpStatus.CREATED)
  async bulkSetup(
    @CurrentTenantId() tenantId: string,
    @Param('projectId') projectId: string,
    @Body() request: {
      providers: Array<{
        templateId: string;
        config: Record<string, any>;
        priority?: number;
        isDefault?: boolean;
      }>;
    }
  ) {
    const results: Array<{
      templateId: string;
      providerId?: string;
      configId?: string;
      status: 'success' | 'error';
      error?: string;
    }> = [];

    for (const providerSetup of request.providers) {
      try {
        const template = this.providerTemplateService.getTemplate(providerSetup.templateId);
        if (!template) {
          throw new Error(`Template ${providerSetup.templateId} not found`);
        }

        // Validate configuration
        const validation = this.providerTemplateService.validateConfiguration(
          providerSetup.templateId,
          providerSetup.config
        );

        if (!validation.isValid) {
          throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        // Create provider configuration
        const providerConfig = await this.providerService.createConfig(tenantId, {
          projectId: projectId,
          providerId: template.providerId,
          providerName: template.name,
          providerType: template.providerId as any,
          channel: template.channel as any,
          config: providerSetup.config,
          priority: providerSetup.priority || 1,
          isDefault: providerSetup.isDefault || false
        });

        results.push({
          templateId: providerSetup.templateId,
          providerId: template.providerId,
          configId: providerConfig.id,
          status: 'success'
        });
      } catch (error) {
        results.push({
          templateId: providerSetup.templateId,
          status: 'error',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return {
      summary: {
        total: request.providers.length,
        successful: successCount,
        failed: errorCount
      },
      results
    };
  }
}