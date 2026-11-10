import { BaseProviderPayload, IBaseProvider } from "../base/base-provider.interface";

export interface PushPayload extends BaseProviderPayload {
  recipient: string;
  title: string;
  body: string;
  imageUrl?: string;
  clickAction?: string;
  customData?: Record<string, any>;
  badge?: number;
  sound?: string;
  priority?: "normal" | "high";
  timeToLive?: number;
  collapseKey?: string;
}

export interface PushConfig {
  apiKey?: string;
  projectId?: string;
  applicationId?: string;
  region?: string;
  certificatePath?: string;
  privateKey?: string;
  customSettings?: Record<string, any>;
}

export interface DeviceRegistration {
  deviceToken: string;
  userId: string;
  platform: "ios" | "android" | "web";
  appVersion?: string;
  metadata?: Record<string, any>;
}

export interface IPushProvider extends IBaseProvider {
  send(payload: PushPayload): Promise<import("../types").ProviderResponse>;

  registerDevice(registration: DeviceRegistration): Promise<void>;

  unregisterDevice(deviceToken: string): Promise<void>;

  validateDeviceToken(deviceToken: string): boolean;

  sendBulk(payloads: PushPayload[]): Promise<import("../types").ProviderResponse[]>;
}
