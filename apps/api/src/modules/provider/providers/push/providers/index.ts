export { FCMProvider } from "./fcm.provider";
export { ExpoPushProvider } from "./expo-push.provider";
export { SNSProvider } from "./sns.provider";
export { ApplePushProvider } from "./apple-push.provider";

export const PUSH_PROVIDERS = ["fcm", "expo-push", "sns", "apple-push"] as const;

export type PushProviderType = (typeof PUSH_PROVIDERS)[number];

export const PUSH_FALLBACK_PROVIDER = "sns";
