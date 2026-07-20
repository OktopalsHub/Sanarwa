import {
  BaseProviderPayload,
  IBaseProvider,
} from '../base/base-provider.interface';

export interface PushPayload extends BaseProviderPayload {
  recipient: string; // device token
  title: string;
  body: string;
  imageUrl?: string;
  clickAction?: string;
  customData?: Record<string, any>;
  badge?: number;
  sound?: string;
  priority?: 'normal' | 'high';
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
  platform: 'ios' | 'android' | 'web';
  appVersion?: string;
  metadata?: Record<string, any>;
}

export interface IPushProvider extends IBaseProvider {
  send(payload: PushPayload): Promise<import('../types').ProviderResponse>;

  /**
   * Register a device token for push notifications
   */
  registerDevice(registration: DeviceRegistration): Promise<void>;

  /**
   * Unregister a device token
   */
  unregisterDevice(deviceToken: string): Promise<void>;

  /**
   * Validate a device token format
   */
  validateDeviceToken(deviceToken: string): boolean;

  /**
   * Send push notification to multiple devices
   */
  sendBulk(
    payloads: PushPayload[],
  ): Promise<import('../types').ProviderResponse[]>;
}
