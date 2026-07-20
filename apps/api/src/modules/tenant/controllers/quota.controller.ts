import { Controller, Get, Optional, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentTenantId } from '../../../common/decorators';
import { BillingService } from '../../billing/services/billing.service';
import { QuotaAwareOrchestratorService } from '../../provider/services/quota-aware-orchestrator.service';
import { TenantService } from '../tenant.service';

@ApiTags('quota')
@Controller('tenants/:tenantId/quota')
export class QuotaController {
  constructor(
    private readonly tenantService: TenantService,
    @Optional() private readonly quotaAwareOrchestrator?: QuotaAwareOrchestratorService,
    private readonly billingService?: BillingService,
  ) { }

  @Get('status')
  @ApiOperation({ summary: 'Get quota status for all channels' })
  @ApiResponse({
    status: 200,
    description: 'Quota status retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getQuotaStatus(@CurrentTenantId() tenantId: string) {
    const tenant = await this.tenantService.getTenantById(tenantId);

    let quotaStatus: any = { channels: {} };
    if (this.quotaAwareOrchestrator) {
      quotaStatus = await this.quotaAwareOrchestrator.getQuotaStatus(tenantId);
    }

    const usage = tenant.usage?.currentMonth || {};
    const quotas = tenant.quotas;

    return {
      tenantId,
      quotas: quotas,
      usage: usage,
      channels: quotaStatus.channels,
      summary: {
        totalNotifications: usage.notifications || 0,
        totalQuota: quotas.notifications?.total || 0,
        remainingQuota: Math.max(0, (quotas.notifications?.total || 0) - (usage.notifications || 0)),
        utilizationPercentage: quotas.notifications?.total && quotas.notifications.total !== -1
          ? ((usage.notifications || 0) / quotas.notifications.total) * 100
          : 0,
      },
    };
  }

  @Get('channels/:channel')
  @ApiOperation({ summary: 'Get quota status for a specific channel' })
  @ApiResponse({
    status: 200,
    description: 'Channel quota status retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getChannelQuotaStatus(
    @CurrentTenantId() tenantId: string,
    @Param('channel') channel: string,
  ) {
    const tenant = await this.tenantService.getTenantById(tenantId);
    const usage = tenant.usage?.currentMonth || {};
    const quotas = tenant.quotas;

    const channelUsage = usage[channel] || 0;
    const channelQuota = quotas.channels?.[channel]?.monthly || 0;
    const hasQuota = await this.tenantService.checkQuotas(tenantId, channel);

    return {
      tenantId,
      channel,
      usage: channelUsage,
      quota: channelQuota,
      remaining: Math.max(0, channelQuota - channelUsage),
      hasQuota,
      utilizationPercentage: channelQuota ? (channelUsage / channelQuota) * 100 : 0,
      status: hasQuota ? 'available' : 'exhausted',
    };
  }

  @Get('usage/history')
  @ApiOperation({ summary: 'Get usage history for the tenant' })
  @ApiResponse({
    status: 200,
    description: 'Usage history retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getUsageHistory(
    @CurrentTenantId() tenantId: string,
    @Query('days') days: number = 30,
  ) {
    // This would typically fetch from a usage history table
    // For now, return current month data
    const tenant = await this.tenantService.getTenantById(tenantId);
    const usage = tenant.usage?.currentMonth || {};

    return {
      tenantId,
      period: {
        days,
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
      currentMonth: usage,
      // In a real implementation, you'd fetch daily/weekly breakdowns
      dailyBreakdown: [],
    };
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Get quota optimization recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Recommendations retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getRecommendations(@CurrentTenantId() tenantId: string) {
    const tenant = await this.tenantService.getTenantById(tenantId);

    let quotaStatus: any = { channels: {} };
    if (this.quotaAwareOrchestrator) {
      quotaStatus = await this.quotaAwareOrchestrator.getQuotaStatus(tenantId);
    }

    const usage = tenant.usage?.currentMonth || {};
    const quotas = tenant.quotas;
    const recommendations: Array<{
      type: string;
      channel: string;
      priority: string;
      title: string;
      description: string;
      action: string;
      savings?: string;
      impact?: string;
    }> = [];

    // Check each channel for recommendations
    for (const [channel, channelStatus] of Object.entries(quotaStatus.channels)) {
      const status = channelStatus as any;
      const channelUsage = usage[channel] || 0;
      const channelQuota = quotas.channels?.[channel]?.monthly || 0;
      const utilizationRate = channelQuota ? (channelUsage / channelQuota) * 100 : 0;

      if (!status.hasBYOP && utilizationRate > 80) {
        recommendations.push({
          type: 'byop_suggestion',
          channel,
          priority: 'high',
          title: `Configure BYOP for ${channel.toUpperCase()}`,
          description: `You're using ${utilizationRate.toFixed(1)}% of your ${channel} quota. Configure your own provider to avoid quota limits.`,
          action: 'configure_byop',
          savings: 'Unlimited usage with your own provider',
        });
      }

      if (!status.hasBYOP && utilizationRate > 50 && utilizationRate <= 80) {
        recommendations.push({
          type: 'byop_suggestion',
          channel,
          priority: 'medium',
          title: `Consider BYOP for ${channel.toUpperCase()}`,
          description: `You're using ${utilizationRate.toFixed(1)}% of your ${channel} quota. Consider configuring your own provider.`,
          action: 'configure_byop',
          savings: 'Avoid future quota limits',
        });
      }

      if (!status.hasQuota) {
        recommendations.push({
          type: 'quota_exhausted',
          channel,
          priority: 'critical',
          title: `${channel.toUpperCase()} quota exhausted`,
          description: `Configure BYOP or purchase more tokens to continue sending ${channel} notifications.`,
          action: 'configure_byop_or_purchase',
          impact: 'Notifications are currently blocked',
        });
      }
    }

    return {
      tenantId,
      recommendations,
      summary: {
        total: recommendations.length,
        critical: recommendations.filter(r => r.priority === 'critical').length,
        high: recommendations.filter(r => r.priority === 'high').length,
        medium: recommendations.filter(r => r.priority === 'medium').length,
      },
    };
  }
}