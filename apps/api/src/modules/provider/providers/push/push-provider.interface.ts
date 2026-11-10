export interface PushPayload {
  deviceTokens: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  imageUrl?: string;
  clickAction?: string;
  category?: string;
  priority?: "high" | "normal";
  ttl?: number;

  deepLink?: {
    url: string;
    fallbackUrl?: string;
    androidAction?: string;
    iosCategory?: string;
  };

  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
    deepLink?: string;
    destructive?: boolean;
  }>;

  android?: {
    channelId?: string;
    color?: string;
    icon?: string;
    tag?: string;
    sticky?: boolean;
    vibrate?: number[];
    lights?: {
      color: string;
      onMs: number;
      offMs: number;
    };
  };

  ios?: {
    threadId?: string;
    subtitle?: string;
    launchImage?: string;
    mutableContent?: boolean;
    contentAvailable?: boolean;
    interruptionLevel?: "passive" | "active" | "timeSensitive" | "critical";
  };
}

export interface PushResponse {
  success: boolean;
  messageId?: string;
  successCount?: number;
  failureCount?: number;
  failedTokens?: string[];
  error?: string;
  provider: string;
}

export interface IPushProvider {
  sendPushNotification(payload: PushPayload): Promise<PushResponse>;
  validateConfig(config?: unknown): Promise<boolean>;
  getProviderName(): string;
}
