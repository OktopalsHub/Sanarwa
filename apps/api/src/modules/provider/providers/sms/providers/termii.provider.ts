import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ISMSProvider,
  SMSPayload,
  SMSResponse,
  BulkSMSPayload,
  BulkSMSResponse,
} from "../sms-provider.interface";

@Injectable()
export class TermiiProvider implements ISMSProvider {
  private readonly logger = new Logger(TermiiProvider.name);
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly apiUrl = "https://v3.api.termii.com/api/sms/send";

  private readonly countryPricing: Record<string, number> = {
    NG: 0.015,
    GH: 0.02,
    KE: 0.025,
    ZA: 0.03,
    UG: 0.025,
    TZ: 0.025,
    RW: 0.03,
    ET: 0.025,
    SN: 0.035,
    CI: 0.035,
    BF: 0.04,
    ML: 0.04,
    BJ: 0.035,
    TG: 0.035,
    "*": 0.05,
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get("TERMII_API_KEY") || "";
    this.senderId = this.configService.get("TERMII_SENDER_ID") || "";
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      const senderId = payload.from || this.senderId;

      const termiiPayload = {
        to: payload.to,
        from: senderId,
        sms: payload.message,
        type: "plain",
        channel: "generic",
        api_key: this.apiKey,
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(termiiPayload),
      });

      const result = (await response.json()) as {
        code?: string;
        message?: string;
        message_id?: string;
        balance?: number;
      };

      if (!response.ok || result.code !== "ok") {
        throw new Error(`Termii API error: ${result.message || response.statusText}`);
      }

      this.logger.log(`SMS sent successfully via Termii: ${result.message_id}`);

      return {
        success: true,
        messageId: result.message_id!,
        cost: result.balance || 0,
        provider: "termii",
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via Termii: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "termii",
      };
    }
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      const senderId = payload.from || this.senderId;
      const results: BulkSMSResponse["results"] = [];
      let totalCost = 0;

      const termiiPayload = {
        to: payload.recipients.join(","),
        from: senderId,
        sms: payload.message,
        type: "plain",
        channel: "generic",
        api_key: this.apiKey,
      };

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(termiiPayload),
      });

      const result = (await response.json()) as {
        code?: string;
        message?: string;
        message_id?: string;
        balance?: number;
      };

      if (!response.ok || result.code !== "ok") {
        payload.recipients.forEach((recipient) => {
          results.push({
            recipient,
            success: false,
            error: result.message || response.statusText,
          });
        });
      } else {
        payload.recipients.forEach((recipient) => {
          results.push({
            recipient,
            messageId: result.message_id,
            success: true,
          });
        });
        totalCost = result.balance || 0;
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk SMS sent via Termii: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: "termii",
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS via Termii: ${error.message}`, error.stack);

      const results = payload.recipients.map((recipient) => ({
        recipient,
        success: false,
        error: error.message,
      }));

      return {
        success: false,
        results,
        totalCost: 0,
        successCount: 0,
        failureCount: payload.recipients.length,
        provider: "termii",
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.apiKey && this.senderId);
  }

  getProviderName(): string {
    return "termii";
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing["*"];
  }
}
