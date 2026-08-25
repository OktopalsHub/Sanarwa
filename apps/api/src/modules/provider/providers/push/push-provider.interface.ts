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
  ttl?: number; // Time to live in seconds

  // Deep linking support
  deepLink?: {
    url: string; // Deep link URL (e.g., "myapp://profile/123")
    fallbackUrl?: string; // Web fallback URL
    androidAction?: string; // Android intent action
    iosCategory?: string; // iOS notification category
  };

  // Action buttons
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
    deepLink?: string;
    destructive?: boolean; // iOS only
  }>;

  // Platform-specific options
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
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
}
