import {
  APNSMessage,
  GCMMessage,
  GetApplicationSettingsCommand,
  MessageRequest,
  PinpointClient,
  PutEventsCommand,
  SendMessagesCommand,
  SendMessagesCommandInput,
} from "@aws-sdk/client-pinpoint";
import { Injectable } from "@nestjs/common";
import { BaseProvider } from "../base/base-provider.abstract";
import { ProviderConfig, ProviderResponse } from "../types";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import {
  DeviceRegistration,
  IPushProvider,
  PushConfig,
  PushPayload,
} from "./push-provider.interface";

@Injectable()
export class PinpointPushProvider extends BaseProvider implements IPushProvider {
  private pinpointClient: PinpointClient;
  private pushConfig: PushConfig;

  constructor() {
    super("pinpoint", "AWS Pinpoint Push", NotificationChannel.PUSH);
  }

  async send(payload: PushPayload): Promise<ProviderResponse> {
    if (!this.isInitialized) {
      return this.createErrorResponse("Provider not initialized");
    }

    try {
      if (!this.validateDeviceToken(payload.recipient)) {
        return this.createErrorResponse("Invalid device token format");
      }

      const messageRequest: MessageRequest = {
        Addresses: {
          [payload.recipient]: {
            ChannelType: "GCM" as any,
          },
        },
        MessageConfiguration: {
          GCMMessage: this.buildGCMMessage(payload),
          APNSMessage: this.buildAPNSMessage(payload),
        },
      };

      const params: SendMessagesCommandInput = {
        ApplicationId: this.pushConfig.applicationId,
        MessageRequest: messageRequest,
      };

      const command = new SendMessagesCommand(params);
      const result = await this.pinpointClient.send(command);

      const messageResult = result.MessageResponse?.Result?.[payload.recipient];

      if (messageResult?.StatusCode === 200) {
        this.logger.log(
          `Push notification sent successfully via Pinpoint: ${messageResult.MessageId}`,
        );

        return this.createSuccessResponse(`pinpoint-${Date.now()}`, messageResult.MessageId, {
          recipient: payload.recipient,
          title: payload.title,
          statusCode: messageResult.StatusCode,
        });
      } else {
        const error = messageResult?.StatusMessage || "Unknown error";
        this.logger.error(`Pinpoint push failed: ${error}`);
        return this.createErrorResponse(`Pinpoint Error: ${error}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification via Pinpoint:`, error);
      return this.createErrorResponse(
        `Pinpoint Error: ${error.message}`,
        `pinpoint-error-${Date.now()}`,
      );
    }
  }

  async sendBulk(payloads: PushPayload[]): Promise<ProviderResponse[]> {
    if (!this.isInitialized) {
      return payloads.map(() => this.createErrorResponse("Provider not initialized"));
    }

    try {
      const addresses: Record<string, any> = {};

      payloads.forEach((payload) => {
        if (this.validateDeviceToken(payload.recipient)) {
          addresses[payload.recipient] = {
            ChannelType: "GCM" as any,
          };
        }
      });

      if (Object.keys(addresses).length === 0) {
        return payloads.map(() => this.createErrorResponse("No valid device tokens"));
      }

      const templatePayload = payloads[0];

      const messageRequest: MessageRequest = {
        Addresses: addresses,
        MessageConfiguration: {
          GCMMessage: this.buildGCMMessage(templatePayload),
          APNSMessage: this.buildAPNSMessage(templatePayload),
        },
      };

      const params: SendMessagesCommandInput = {
        ApplicationId: this.pushConfig.applicationId,
        MessageRequest: messageRequest,
      };

      const command = new SendMessagesCommand(params);
      const result = await this.pinpointClient.send(command);

      return payloads.map((payload) => {
        const messageResult = result.MessageResponse?.Result?.[payload.recipient];

        if (messageResult?.StatusCode === 200) {
          return this.createSuccessResponse(
            `pinpoint-bulk-${Date.now()}`,
            messageResult.MessageId,
            {
              recipient: payload.recipient,
              title: payload.title,
            },
          );
        } else {
          const error = messageResult?.StatusMessage || "Unknown error";
          return this.createErrorResponse(`Pinpoint Error: ${error}`);
        }
      });
    } catch (error) {
      this.logger.error(`Failed to send bulk push notifications via Pinpoint:`, error);
      return payloads.map(() => this.createErrorResponse(`Pinpoint Bulk Error: ${error.message}`));
    }
  }

  async registerDevice(registration: DeviceRegistration): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      const params = {
        ApplicationId: this.pushConfig.applicationId,
        EventsRequest: {
          BatchItem: {
            [registration.userId]: {
              Endpoint: {
                ChannelType: registration.platform === "ios" ? ("APNS" as any) : ("GCM" as any),
                Address: registration.deviceToken,
                User: {
                  UserId: registration.userId,
                },
                Attributes: registration.metadata || {},
              },
              Events: {
                device_registration: {
                  EventType: "device_registration",
                  Timestamp: new Date().toISOString(),
                  Attributes: {
                    platform: registration.platform,
                    app_version: registration.appVersion || "unknown",
                  },
                },
              },
            },
          },
        },
      };

      const command = new PutEventsCommand(params);
      await this.pinpointClient.send(command);

      this.logger.log(`Device registered successfully: ${registration.deviceToken}`);
    } catch (error) {
      this.logger.error(`Failed to register device:`, error);
      throw error;
    }
  }

  async unregisterDevice(deviceToken: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Provider not initialized");
    }

    try {
      this.logger.log(`Device unregistration requested: ${deviceToken}`);
    } catch (error) {
      this.logger.error(`Failed to unregister device:`, error);
      throw error;
    }
  }

  validateDeviceToken(deviceToken: string): boolean {
    if (!deviceToken || typeof deviceToken !== "string") {
      return false;
    }

    const iosTokenRegex = /^[a-fA-F0-9]{64}$/;
    const androidTokenRegex = /^[A-Za-z0-9_-]+$/;

    return (
      iosTokenRegex.test(deviceToken) ||
      (androidTokenRegex.test(deviceToken) && deviceToken.length > 100)
    );
  }

  async validateConfig(config: ProviderConfig): Promise<boolean> {
    if (!this.validateCommonConfig(config)) {
      return false;
    }

    const credentials = config.credentials as PushConfig;

    if (!credentials.applicationId) {
      this.logger.error("Pinpoint configuration missing applicationId");
      return false;
    }

    if (!credentials.region) {
      this.logger.error("Pinpoint configuration missing region");
      return false;
    }

    return true;
  }

  protected async onInitialize(): Promise<void> {
    this.pushConfig = this.config.credentials as PushConfig;

    this.pinpointClient = new PinpointClient({
      region: this.pushConfig.region,
      credentials: this.pushConfig.apiKey
        ? {
            accessKeyId: this.pushConfig.apiKey,
            secretAccessKey: this.config.credentials.secretKey || "",
          }
        : undefined,
    });

    this.logger.log(
      `Pinpoint Push Provider initialized for application: ${this.pushConfig.applicationId}`,
    );
  }

  protected async onDestroy(): Promise<void> {
    if (this.pinpointClient) {
      this.pinpointClient.destroy();
      this.pinpointClient = undefined as any;
    }
  }

  private buildGCMMessage(payload: PushPayload): GCMMessage {
    return {
      Action: payload.clickAction ? "URL" : "OPEN_APP",
      Body: payload.body,
      Title: payload.title,
      Url: payload.clickAction,
      ImageUrl: payload.imageUrl,
      Data: payload.customData,
      Priority: payload.priority === "high" ? "high" : "normal",
      TimeToLive: payload.timeToLive || 86400,
      CollapseKey: payload.collapseKey,
    };
  }

  private buildAPNSMessage(payload: PushPayload): APNSMessage {
    return {
      Action: payload.clickAction ? "URL" : "OPEN_APP",
      Body: payload.body,
      Title: payload.title,
      Url: payload.clickAction,
      MediaUrl: payload.imageUrl,
      Data: payload.customData,
      Priority: payload.priority === "high" ? "high" : "normal",
      TimeToLive: payload.timeToLive || 86400,
      Badge: payload.badge,
      Sound: payload.sound || "default",
    };
  }
}
