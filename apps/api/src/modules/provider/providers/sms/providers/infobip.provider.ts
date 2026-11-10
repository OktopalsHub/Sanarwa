import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ISMSProvider,
  SMSPayload,
  SMSResponse,
  BulkSMSPayload,
  BulkSMSResponse,
} from "../sms-provider.interface";

interface InfobipMessage {
  messageId: string;
  status: {
    groupName: string;
    name: string;
    description?: string;
  };
}

interface InfobipResponse {
  messages?: InfobipMessage[];
  requestError?: {
    serviceException?: {
      text: string;
    };
  };
}

@Injectable()
export class InfobipProvider implements ISMSProvider {
  private readonly logger = new Logger(InfobipProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  private readonly countryPricing: Record<string, number> = {
    US: 0.0075,
    CA: 0.0075,
    GB: 0.035,
    DE: 0.065,
    FR: 0.065,
    AU: 0.045,
    IN: 0.006,
    BR: 0.02,
    MX: 0.02,
    JP: 0.07,
    KR: 0.04,
    CN: 0.045,
    NG: 0.018,
    ZA: 0.025,
    KE: 0.02,
    GH: 0.018,
    "*": 0.04,
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get("INFOBIP_API_KEY") || "";
    this.baseUrl = this.configService.get("INFOBIP_BASE_URL") || "https://api.infobip.com";
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      const infobipPayload = {
        messages: [
          {
            from: payload.from || "InfoSMS",
            destinations: [
              {
                to: payload.to,
              },
            ],
            text: payload.message,
          },
        ],
      };

      const response = await fetch(`${this.baseUrl}/sms/2/text/advanced`, {
        method: "POST",
        headers: {
          Authorization: `App ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(infobipPayload),
      });

      const result = (await response.json()) as InfobipResponse;

      if (!response.ok) {
        throw new Error(
          `Infobip API error: ${result.requestError?.serviceException?.text || response.statusText}`,
        );
      }

      const message = result.messages?.[0];
      const isSuccess = message?.status?.groupName === "PENDING";

      this.logger.log(
        `SMS sent via Infobip: ${message?.messageId}, status: ${message?.status?.name}`,
      );

      return {
        success: isSuccess,
        messageId: message?.messageId,
        cost: this.getCostPerMessage(this.extractCountryCode(payload.to)),
        provider: "infobip",
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via Infobip: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "infobip",
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!this.apiKey;
  }

  getProviderName(): string {
    return "infobip";
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing["*"];
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      const infobipPayload = {
        messages: [
          {
            from: payload.from || "InfoSMS",
            destinations: payload.recipients.map((to) => ({ to })),
            text: payload.message,
          },
        ],
      };

      const response = await fetch(`${this.baseUrl}/sms/2/text/advanced`, {
        method: "POST",
        headers: {
          Authorization: `App ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(infobipPayload),
      });

      const result = (await response.json()) as InfobipResponse;

      if (!response.ok) {
        throw new Error(
          `Infobip API error: ${result.requestError?.serviceException?.text || response.statusText}`,
        );
      }

      const results: BulkSMSResponse["results"] = [];
      let totalCost = 0;

      const messages = result.messages || [];
      payload.recipients.forEach((recipient, index) => {
        const message = messages[index];
        const isSuccess = message?.status?.groupName === "PENDING";
        const cost = this.getCostPerMessage(this.extractCountryCode(recipient));

        results.push({
          recipient,
          messageId: message?.messageId,
          success: isSuccess,
          error: isSuccess ? undefined : message?.status?.description,
        });

        if (isSuccess) {
          totalCost += cost;
        }
      });

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(`Bulk SMS sent via Infobip: ${successCount} success, ${failureCount} failed`);

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: "infobip",
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS via Infobip: ${error.message}`, error.stack);

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
        provider: "infobip",
      };
    }
  }

  private extractCountryCode(phoneNumber: string): string {
    if (phoneNumber.startsWith("+1")) return "US";
    if (phoneNumber.startsWith("+44")) return "GB";
    if (phoneNumber.startsWith("+49")) return "DE";
    if (phoneNumber.startsWith("+234")) return "NG";
    if (phoneNumber.startsWith("+91")) return "IN";
    return "*";
  }
}
