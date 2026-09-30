import {
  GetSMSAttributesCommand,
  PublishCommand,
  PublishCommandInput,
  SNSClient,
} from "@aws-sdk/client-sns";
import { Injectable } from "@nestjs/common";
import { BaseProvider } from "../base/base-provider.abstract";
import {
  Channel,
  ProviderConfig,
  ProviderHealth,
  ProviderHealthStatus,
  ProviderResponse,
} from "../types";
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
    // Add more countries as needed
  ];

  constructor() {
    super("sns", "AWS SNS SMS", Channel.SMS);
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

    // SNS can work with default AWS credentials, so API key is optional
    // But if provided, it should be valid
    if (credentials.apiKey && !credentials.apiSecret) {
      this.logger.error("SNS configuration has apiKey but missing apiSecret");
      return false;
    }

    return true;
  }

  protected async performHealthCheck(): Promise<ProviderHealthStatus> {
    if (!this.snsClient) {
      throw new Error("SNS client not initialized");
    }

    try {
      // Test SNS connectivity by getting SMS attributes
      const command = new GetSMSAttributesCommand({});
      await this.snsClient.send(command);

      return {
        status: ProviderHealth.HEALTHY,
        lastChecked: new Date(),
        uptime: 100,
        metadata: {
          service: "AWS SNS SMS",
          region: this.snsClient.config.region,
          supportedCountries: this.supportedCountries.length,
        },
      };
    } catch (error) {
      throw new Error(`SNS health check failed: ${error.message}`, { cause: error });
    }
  }

  protected async onInitialize(): Promise<void> {
    this.smsConfig = this.config.credentials as SMSConfig;

    // Initialize SNS client
    this.snsClient = new SNSClient({
      region: this.smsConfig.region || "us-east-1",
      credentials: this.smsConfig.apiKey
        ? {
            accessKeyId: this.smsConfig.apiKey,
            secretAccessKey: this.smsConfig.apiSecret || "",
          }
        : undefined, // Use default credential chain if no explicit credentials
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
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, "");

    // If number already starts with +, return as is
    if (phoneNumber.startsWith("+")) {
      return phoneNumber;
    }

    // If number starts with country code, add +
    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }

    // Add default country code if provided
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

    // Default to US format if no country code provided
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    return `+${cleaned}`;
  }

  /**
   * Get SMS spending limit
   */
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

  /**
   * Set SMS attributes (like spending limit)
   */
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
