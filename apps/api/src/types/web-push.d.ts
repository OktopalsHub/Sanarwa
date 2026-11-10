declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }

  export interface SendOptions {
    TTL?: number;
    urgency?: "very-low" | "low" | "normal" | "high";
    topic?: string;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    contentEncoding?: string;
    headers?: Record<string, string>;
  }

  export function sendNotification(
    subscription: PushSubscription,
    payload?: Buffer | string,
    options?: SendOptions,
  ): Promise<{ statusCode: number }>;

  export function generateVAPIDKeys(): {
    publicKey: string;
    privateKey: string;
  };
}
