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
export class TelnyxProvider implements ISMSProvider {
  private readonly logger = new Logger(TelnyxProvider.name);
  private readonly apiKey: string;
  private readonly messagingProfileId: string;

  // Telnyx pricing (competitive global rates, in USD)
  private readonly countryPricing: Record<string, number> = {
    US: 0.004, // United States - very competitive
    CA: 0.004, // Canada
    GB: 0.035, // United Kingdom
    DE: 0.065, // Germany
    FR: 0.065, // France
    AU: 0.045, // Australia
    IN: 0.0035, // India - very competitive
    BR: 0.015, // Brazil
    MX: 0.015, // Mexico
    JP: 0.065, // Japan
    KR: 0.035, // South Korea
    CN: 0.04, // China
    NG: 0.02, // Nigeria
    ZA: 0.03, // South Africa
    KE: 0.025, // Kenya
    GH: 0.02, // Ghana
    "*": 0.035, // Default for other countries
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get("TELNYX_API_KEY") || "";
    this.messagingProfileId = this.configService.get("TELNYX_MESSAGING_PROFILE_ID") || "";
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      const telnyxPayload = {
        from: payload.from || "Telnyx",
        to: payload.to,
        text: payload.message,
        messaging_profile_id: this.messagingProfileId,
      };

      const response = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(telnyxPayload),
      });

      const result = (await response.json()) as {
        data?: { id: string };
        errors?: { detail: string }[];
      };

      if (!response.ok) {
        throw new Error(`Telnyx API error: ${result.errors?.[0]?.detail || response.statusText}`);
      }

      this.logger.log(`SMS sent successfully via Telnyx: ${result.data!.id}`);

      return {
        success: true,
        messageId: result.data!.id,
        cost: this.getCostPerMessage(this.extractCountryCode(payload.to)),
        provider: "telnyx",
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via Telnyx: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "telnyx",
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.apiKey && this.messagingProfileId);
  }

  getProviderName(): string {
    return "telnyx";
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing["*"];
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      const results: BulkSMSResponse["results"] = [];
      let totalCost = 0;

      // Telnyx doesn't have native bulk SMS, so we send individual messages
      for (const recipient of payload.recipients) {
        try {
          const smsResult = await this.sendSMS({
            to: recipient,
            message: payload.message,
            from: payload.from,
            metadata: payload.metadata,
          });

          results.push({
            recipient,
            messageId: smsResult.messageId,
            success: smsResult.success,
            error: smsResult.error,
          });

          if (smsResult.success && smsResult.cost) {
            totalCost += smsResult.cost;
          }
        } catch (error) {
          results.push({
            recipient,
            success: false,
            error: error.message,
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk SMS sent via Telnyx: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: "telnyx",
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS via Telnyx: ${error.message}`, error.stack);

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
        provider: "telnyx",
      };
    }
  }

  private extractCountryCode(phoneNumber: string): string {
    // Simple extraction - in production, use libphonenumber-js
    if (phoneNumber.startsWith("+1")) return "US";
    if (phoneNumber.startsWith("+44")) return "GB";
    if (phoneNumber.startsWith("+49")) return "DE";
    if (phoneNumber.startsWith("+234")) return "NG";
    if (phoneNumber.startsWith("+91")) return "IN";
    return "*";
  }
}
