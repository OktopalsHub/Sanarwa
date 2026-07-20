import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingMode,
  channelTokenCosts,
  normalizeBillingChannel,
  resolveTokenCost,
} from '../../billing/constants/token-pricing';

export interface BillingResult {
  charged: boolean;
  amount: number;
  currency: string;
  reason: string;
  metadata?: Record<string, any>;
}

export interface VoiceUsageData {
  voiceMinutes: number;
  ttsCharacters: number;
  provider: string;
  timestamp: Date;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly configService: ConfigService) { }

  /**
   * Calculate token cost for a notification event
   */
  async calculateEventBilling(
    tenantId: string,
    eventType: string,
    eventCount: number = 1,
    metadata?: Record<string, any>,
    billingMode: BillingMode = 'managed',
  ): Promise<BillingResult> {
    try {
      const channel = normalizeBillingChannel(eventType);
      const units =
        channel === 'voice'
          ? Math.ceil(Number(metadata?.durationMinutes ?? metadata?.voiceMinutes ?? eventCount) || 1)
          : eventCount;
      const tokensRequired = resolveTokenCost(channel, billingMode, units);
      const costs = channelTokenCosts(billingMode);

      return {
        charged: true,
        amount: tokensRequired,
        currency: 'tokens',
        reason: `${billingMode} ${eventType} notification requires ${tokensRequired} token(s)`,
        metadata: {
          eventType,
          eventCount,
          billingMode,
          tokensPerEvent: costs[channel] ?? 1,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to calculate event billing: ${error.message}`);
      return {
        charged: false,
        amount: 0,
        currency: 'tokens',
        reason: `Billing error: ${error.message}`,
      };
    }
  }

  getTokenPricing(mode: BillingMode = 'managed'): Record<string, number> {
    return channelTokenCosts(mode);
  }

  /**
   * Calculate total cost for multiple events
   */
  async calculateTotalCost(
    events: Array<{ type: string; count: number }>,
    billingMode: BillingMode = 'managed',
  ): Promise<number> {
    let totalCost = 0;

    for (const event of events) {
      const channel = normalizeBillingChannel(event.type);
      totalCost += resolveTokenCost(channel, billingMode, event.count);
    }

    return totalCost;
  }

  /**
   * Deduct voice usage from tenant quota
   */
  async deductVoiceUsage(tenantId: string, usage: VoiceUsageData): Promise<void> {
    try {
      this.logger.log(
        `Deducting voice usage for tenant ${tenantId}: ${usage.voiceMinutes} minutes, ${usage.ttsCharacters} TTS chars`
      );

      // Here you would integrate with your actual billing/quota system
      // For example:
      // - Update tenant's remaining voice minutes
      // - Log usage for billing purposes
      // - Check if tenant has exceeded quota
      // - Send alerts if quota is low

      // Example implementation (replace with your actual billing logic):
      /*
      await this.quotaService.deductUsage(tenantId, {
        type: 'voice_minutes',
        amount: usage.voiceMinutes,
        metadata: {
          provider: usage.provider,
          ttsCharacters: usage.ttsCharacters,
          timestamp: usage.timestamp,
        }
      });
      */

      this.logger.log(`Voice usage deducted successfully for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to deduct voice usage: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get voice usage pricing
   */
  getVoicePricing(): { voicePerMinute: number; ttsPerCharacter: number } {
    return {
      voicePerMinute: 0.025, // $0.025 per minute (example)
      ttsPerCharacter: 0.000016, // $16 per 1M characters
    };
  }

  /**
   * Check if billing is enabled
   */
  isBillingEnabled(): boolean {
    return this.configService.get<boolean>('BILLING_ENABLED', true);
  }
}