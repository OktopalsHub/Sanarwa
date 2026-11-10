import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ISMSProvider,
  SMSPayload,
  SMSResponse,
  BulkSMSPayload,
  BulkSMSResponse,
} from "../sms-provider.interface";

import AfricasTalking from "africastalking";

@Injectable()
export class AfricasTalkingProvider implements ISMSProvider {
  private readonly logger = new Logger(AfricasTalkingProvider.name);
  private readonly apiKey: string;
  private readonly username: string;
  private readonly shortCode: string;
  private readonly africasTalking: any;
  private readonly sms: any;

  private readonly countryPricing: Record<string, number> = {
    KE: 0.008,
    UG: 0.012,
    TZ: 0.015,
    RW: 0.018,
    NG: 0.02,
    GH: 0.025,
    ZA: 0.03,
    MW: 0.015,
    ZM: 0.02,
    BW: 0.025,
    ET: 0.02,
    SN: 0.03,
    CI: 0.03,
    BF: 0.035,
    ML: 0.035,
    NE: 0.035,
    TD: 0.04,
    CM: 0.025,
    GA: 0.035,
    CG: 0.04,
    CD: 0.04,
    CF: 0.045,
    AO: 0.035,
    MZ: 0.03,
    MG: 0.035,
    MU: 0.025,
    SC: 0.04,
    DJ: 0.04,
    SO: 0.045,
    SS: 0.05,
    SD: 0.045,
    EG: 0.03,
    LY: 0.04,
    TN: 0.035,
    DZ: 0.035,
    MA: 0.03,
    "*": 0.04,
  };

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get("AFRICASTALKING_API_KEY") || "";
    this.username = this.configService.get("AFRICASTALKING_USERNAME") || "";
    this.shortCode = this.configService.get("AFRICASTALKING_SHORT_CODE") || "";

    if (this.apiKey && this.username) {
      try {
        this.africasTalking = AfricasTalking({
          apiKey: this.apiKey,
          username: this.username,
        });
        this.sms = this.africasTalking.SMS;
        this.logger.log("AfricasTalking SDK initialized successfully");
      } catch (error) {
        this.logger.error("Failed to initialize AfricasTalking SDK:", error.message);
      }
    }
  }

  async sendSMS(payload: SMSPayload): Promise<SMSResponse> {
    try {
      if (!this.sms) {
        throw new Error("AfricasTalking SDK not initialized. Check your API key and username.");
      }

      const senderId = payload.from || this.shortCode || this.username;

      const options = {
        to: [payload.to],
        message: payload.message,
        from: senderId,
      };

      this.logger.log(`Sending SMS via AfricasTalking to ${payload.to} from ${senderId}`);

      const result = await this.sms.send(options);

      const recipients = result.SMSMessageData?.Recipients || [];

      if (recipients.length === 0) {
        throw new Error("No recipient data returned from AfricasTalking");
      }

      const recipient = recipients[0];

      if (recipient.status !== "Success") {
        throw new Error(`Message failed: ${recipient.status} - ${recipient.statusCode}`);
      }

      this.logger.log(`SMS sent successfully via AfricasTalking: ${recipient.messageId}`);

      const cost =
        this.parseCost(recipient.cost) ||
        this.getCostPerMessage(this.extractCountryCode(payload.to));

      return {
        success: true,
        messageId: recipient.messageId,
        cost: cost,
        provider: "africastalking",
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS via AfricasTalking: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
        provider: "africastalking",
      };
    }
  }

  async sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse> {
    try {
      if (!this.sms) {
        throw new Error("AfricasTalking SDK not initialized. Check your API key and username.");
      }

      const senderId = payload.from || this.shortCode || this.username;

      const options = {
        to: payload.recipients,
        message: payload.message,
        from: senderId,
      };

      this.logger.log(
        `Sending bulk SMS via AfricasTalking to ${payload.recipients.length} recipients from ${senderId}`,
      );

      const result = await this.sms.send(options);

      const recipients = result.SMSMessageData?.Recipients || [];
      const results: BulkSMSResponse["results"] = [];
      let totalCost = 0;

      payload.recipients.forEach((recipient, index) => {
        const recipientResult = recipients.find((r) => r.number === recipient) || recipients[index];

        if (recipientResult) {
          const isSuccess = recipientResult.status === "Success";
          const cost = isSuccess
            ? this.parseCost(recipientResult.cost) ||
              this.getCostPerMessage(this.extractCountryCode(recipient))
            : 0;

          results.push({
            recipient,
            messageId: recipientResult.messageId,
            success: isSuccess,
            error: isSuccess
              ? undefined
              : `${recipientResult.status} - ${recipientResult.statusCode}`,
          });

          if (isSuccess) {
            totalCost += cost;
          }
        } else {
          results.push({
            recipient,
            success: false,
            error: "No response data for this recipient",
          });
        }
      });

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      this.logger.log(
        `Bulk SMS sent via AfricasTalking: ${successCount} success, ${failureCount} failed`,
      );

      return {
        success: successCount > 0,
        results,
        totalCost,
        successCount,
        failureCount,
        provider: "africastalking",
      };
    } catch (error) {
      this.logger.error(
        `Failed to send bulk SMS via AfricasTalking: ${error.message}`,
        error.stack,
      );

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
        provider: "africastalking",
      };
    }
  }

  async validateConfig(): Promise<boolean> {
    return !!(this.apiKey && this.username && this.sms);
  }

  getProviderName(): string {
    return "africastalking";
  }

  getSupportedCountries(): string[] {
    return Object.keys(this.countryPricing);
  }

  getCostPerMessage(countryCode: string): number {
    return this.countryPricing[countryCode] || this.countryPricing["*"];
  }

  private parseCost(costString: string): number {
    if (!costString) return 0;

    try {
      const match = costString.match(/[\d.]+/);
      if (match) {
        const amount = parseFloat(match[0]);

        if (costString.includes("KES")) {
          return amount * 0.0067;
        } else if (costString.includes("NGN")) {
          return amount * 0.0013;
        } else if (costString.includes("GHS")) {
          return amount * 0.084;
        } else if (costString.includes("ZAR")) {
          return amount * 0.055;
        } else {
          return amount;
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse cost: ${costString}`, error.message);
    }

    return 0;
  }

  private extractCountryCode(phoneNumber: string): string {
    if (phoneNumber.startsWith("+254")) return "KE";
    if (phoneNumber.startsWith("+234")) return "NG";
    if (phoneNumber.startsWith("+233")) return "GH";
    if (phoneNumber.startsWith("+27")) return "ZA";
    if (phoneNumber.startsWith("+256")) return "UG";
    if (phoneNumber.startsWith("+255")) return "TZ";
    if (phoneNumber.startsWith("+250")) return "RW";
    if (phoneNumber.startsWith("+251")) return "ET";
    if (phoneNumber.startsWith("+221")) return "SN";
    if (phoneNumber.startsWith("+225")) return "CI";
    if (phoneNumber.startsWith("+226")) return "BF";
    if (phoneNumber.startsWith("+223")) return "ML";
    if (phoneNumber.startsWith("+229")) return "BJ";
    if (phoneNumber.startsWith("+228")) return "TG";
    return "*";
  }
}
