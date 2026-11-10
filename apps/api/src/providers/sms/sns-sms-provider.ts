import {
  GetSMSAttributesCommand,
  PublishCommand,
  PublishCommandInput,
  SNSClient,
} from "@aws-sdk/client-sns";
import { Injectable } from "@nestjs/common";
import { BaseProvider } from "../base/base-provider.abstract";
import { ProviderConfig, ProviderResponse } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ISMSProvider, SMSConfig, SMSPayload } from "./sms-provider.interface";

@Injectable()
export class SNSSMSProvider extends BaseProvider implements ISMSProvider {
  private snsClient: SNSClient;
  private smsConfig: SMSConfig;
  private readonly supportedCountries: string[] = [
    "US",
    "CA",
    "GB",
    "DE",
    "FR",
    "IT",
    "ES",
    "AU",
    "JP",
    "IN",
    "BR",
    "MX",
  ];

  constructor() {
    super("sns", "AWS SNS SMS", NotificationChannel.SMS);
  }

  async send(payload: SMSPayload): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      return this.createErrorResponse("Provider not initialized");
    }

    try {
      const formattedNumber = this.formatPhoneNumber(payload.recipient, payload.countryCode);

      const params: PublishCommandInput = {
        PhoneNumber: formattedNumber,
        Message: payload.message,
        MessageAttributes: {
          "AWS.SNS.SMS.SenderID": {
            DataType: "String",
            StringValue: payload.from || this.smsConfig.senderId || "AWS",
          },
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      };

      const command = new PublishCommand(params);
      const result = await this.snsClient.send(command);

      this.logger.log(`SMS sent successfully via SNS: ${result.MessageId}`);

      return this.createSuccessResponse(`sns-${Date.now()}`, result.MessageId, {
        recipient: formattedNumber,
        message: payload.message,
      });
    } catch (error) {
      this.logger.error(`Failed to send SMS via SNS:`, error);
      return this.createErrorResponse(`SNS Error: ${error.message}`, `sns-error-${Date.now()}`);
    }
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    if (!this.validateCommonConfig(config)) {
      return false;
    }

    const credentials = config.credentials as SMSConfig;

    if (credentials.apiKey && !credentials.apiSecret) {
      this.logger.error("SNS configuration has apiKey but missing apiSecret");
      return false;
    }

    return true;
  }

  protected async onInitialize(): Promise<void> {
    this.smsConfig = this.config.credentials as SMSConfig;

    this.snsClient = new SNSClient({
      region: this.smsConfig.region || "us-east-1",
      credentials: this.smsConfig.apiKey
        ? {
            accessKeyId: this.smsConfig.apiKey,
            secretAccessKey: this.smsConfig.apiSecret || "",
          }
        : undefined,
    });

    this.logger.log(
      `SNS SMS Provider initialized for region: ${this.smsConfig.region || "us-east-1"}`,
    );
  }

  protected async onDestroy(): Promise<void> {
    if (this.snsClient) {
      this.snsClient.destroy();
      this.snsClient = undefined as any;
    }
  }

  getSupportedCountries(): string[] {
    return [...this.supportedCountries];
  }

  isCountrySupported(countryCode: string): boolean {
    return this.supportedCountries.includes(countryCode.toUpperCase());
  }

  formatPhoneNumber(phoneNumber: string, countryCode?: string): string {
    const cleaned = phoneNumber.replace(/\D/g, "");

    if (phoneNumber.startsWith("+")) {
      return phoneNumber;
    }

    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }

    if (countryCode) {
      const countryCodeMap: Record<string, string> = {
        US: "1",
        CA: "1",
        GB: "44",
        DE: "49",
        FR: "33",
        IT: "39",
        ES: "34",
        AU: "61",
        JP: "81",
        IN: "91",
        BR: "55",
        MX: "52",
      };

      const code = countryCodeMap[countryCode.toUpperCase()];
      if (code) {
        return `+${code}${cleaned}`;
      }
    }

    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    return `+${cleaned}`;
  }

  async getSMSSpendingLimit(): Promise<any> {
    if (!this.snsClient) {
      throw new Error("SNS client not initialized");
    }

    try {
      const command = new GetSMSAttributesCommand({});
      const result = await this.snsClient.send(command);
      return result.attributes;
    } catch (error) {
      this.logger.error("Failed to get SMS spending limit:", error);
      throw error;
    }
  }

  async setSMSAttributes(attributes: Record<string, string>): Promise<void> {
    if (!this.snsClient) {
      throw new Error("SNS client not initialized");
    }

    try {
      const { SetSMSAttributesCommand } = await import("@aws-sdk/client-sns");
      const command = new SetSMSAttributesCommand({
        attributes,
      });
      await this.snsClient.send(command);
      this.logger.log("SMS attributes updated successfully");
    } catch (error) {
      this.logger.error("Failed to set SMS attributes:", error);
      throw error;
    }
  }
}
