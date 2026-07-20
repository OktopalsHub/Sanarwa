import { Injectable, Logger } from '@nestjs/common';
import { TokenManagementService } from '../../token-management/services/token-management.service';
import { TokenTransactionType } from '../entities/token-balance.entity';
import {
  BillingMode,
  normalizeBillingChannel,
  resolveTokenCost,
} from '../constants/token-pricing';

@Injectable()
export class BillingIntegrationService {
  private readonly logger = new Logger(BillingIntegrationService.name);

  constructor(
    private tokenManagementService: TokenManagementService,
  ) {}

  calculateEventBilling(
    eventType: string,
    billingMode: BillingMode,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): { charged: boolean; amount: number; currency: string; reason: string; billingMode: BillingMode } {
    const channel = normalizeBillingChannel(eventType);
    const units =
      channel === 'voice'
        ? Math.ceil(Number(metadata?.durationMinutes ?? metadata?.voiceMinutes ?? eventCount) || 1)
        : eventCount;
    const tokensRequired = resolveTokenCost(channel, billingMode, units);

    return {
      charged: true,
      amount: tokensRequired,
      currency: 'tokens',
      billingMode,
      reason: `${billingMode} ${channel} requires ${tokensRequired} token(s)`,
    };
  }

  async processNotificationTokenUsage(
    tenantId: string,
    eventType: string,
    notificationId: string,
    billingMode: BillingMode,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): Promise<void> {
    const billing = this.calculateEventBilling(eventType, billingMode, metadata, eventCount);

    await this.tokenManagementService.useTokens({
      tenantId,
      amount: billing.amount,
      description: `${billingMode} ${eventType} notification`,
      referenceId: notificationId,
      metadata: {
        eventType,
        notificationId,
        billingMode,
        ...metadata,
      },
    });

    this.logger.log(
      `Processed ${billingMode} token usage for tenant ${tenantId}: ${billing.amount} tokens for ${eventType}`,
    );
  }

  async checkSufficientTokens(
    tenantId: string,
    eventType: string,
    billingMode: BillingMode,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): Promise<boolean> {
    const billing = this.calculateEventBilling(eventType, billingMode, metadata, eventCount);
    return this.tokenManagementService.checkSufficientTokens(tenantId, billing.amount);
  }

  async reserveTokensForNotification(
    tenantId: string,
    eventType: string,
    notificationId: string,
    billingMode: BillingMode,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): Promise<void> {
    const billing = this.calculateEventBilling(eventType, billingMode, metadata, eventCount);
    await this.tokenManagementService.reserveTokens(tenantId, billing.amount, notificationId);

    this.logger.log(
      `Reserved ${billing.amount} ${billingMode} tokens for tenant ${tenantId} notification ${notificationId}`,
    );
  }

  async releaseReservedTokens(
    tenantId: string,
    eventType: string,
    billingMode: BillingMode,
    notificationId: string,
    consume = true,
    metadata?: Record<string, unknown>,
    eventCount = 1,
  ): Promise<void> {
    const billing = this.calculateEventBilling(eventType, billingMode, metadata, eventCount);
    await this.tokenManagementService.releaseReservedTokens(tenantId, billing.amount, consume);

    this.logger.log(
      `${consume ? 'Consumed' : 'Released'} ${billing.amount} reserved ${billingMode} tokens for tenant ${tenantId}`,
    );
  }

  async getTokenUsageSummary(tenantId: string): Promise<{
    balance: unknown;
    recentUsage: unknown[];
    monthlyUsage: unknown;
  }> {
    const balance = await this.tokenManagementService.getBalance(tenantId);

    const { transactions } = await this.tokenManagementService.getTransactionHistory(
      tenantId,
      10,
      0,
      TokenTransactionType.USAGE,
    );

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyUsage = await this.tokenManagementService.getTokenUsageStats(
      tenantId,
      startOfMonth,
      new Date(),
    );

    return {
      balance,
      recentUsage: transactions,
      monthlyUsage,
    };
  }
}
