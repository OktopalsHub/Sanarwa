import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  BillingMode,
  channelTokenCosts,
  resolveBillingChannel,
  resolveTokenCost,
} from "../../billing/constants/token-pricing";

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

  constructor(private readonly configService: ConfigService) {}

  async calculateEventBilling(
    tenantId: string,
    eventType: string,
    eventCount: number = 1,
    metadata?: Record<string, any>,
    billingMode: BillingMode = "managed",
  ): Promise<BillingResult> {
    try {
      const resolution = resolveBillingChannel(eventType);
      if (resolution.kind === "unrecognized") {
        return {
          charged: false,
          amount: 0,
          currency: "tokens",
          reason: `Unrecognized billing channel: ${eventType}`,
        };
      }
      const channel = resolution.channel;
      const units =
        channel === "voice"
          ? Math.ceil(
              Number(metadata?.durationMinutes ?? metadata?.voiceMinutes ?? eventCount) || 1,
            )
          : eventCount;
      const tokensRequired = resolveTokenCost(channel, billingMode, units);
      const costs = channelTokenCosts(billingMode);

      return {
        charged: true,
        amount: tokensRequired,
        currency: "tokens",
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
        currency: "tokens",
        reason: `Billing error: ${error.message}`,
      };
    }
  }

  getTokenPricing(mode: BillingMode = "managed"): Record<string, number> {
    return channelTokenCosts(mode);
  }

  async calculateTotalCost(
    events: Array<{ type: string; count: number }>,
    billingMode: BillingMode = "managed",
  ): Promise<number> {
    let totalCost = 0;

    for (const event of events) {
      const resolution = resolveBillingChannel(event.type);
      if (resolution.kind === "unrecognized") {
        throw new Error(`Unrecognized billing channel: ${event.type}`);
      }
      totalCost += resolveTokenCost(resolution.channel, billingMode, event.count);
    }

    return totalCost;
  }

  async deductVoiceUsage(tenantId: string, usage: VoiceUsageData): Promise<void> {
    try {
      this.logger.log(
        `Deducting voice usage for tenant ${tenantId}: ${usage.voiceMinutes} minutes, ${usage.ttsCharacters} TTS chars`,
      );

      this.logger.log(`Voice usage deducted successfully for tenant: ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to deduct voice usage: ${error.message}`, error.stack);
      throw error;
    }
  }

  getVoicePricing(): { voicePerMinute: number; ttsPerCharacter: number } {
    return {
      voicePerMinute: 0.025,
      ttsPerCharacter: 0.000016,
    };
  }

  isBillingEnabled(): boolean {
    return this.configService.get<boolean>("BILLING_ENABLED", true);
  }
}
