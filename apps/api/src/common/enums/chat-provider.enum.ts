export const CHAT_PROVIDERS = ["slack", "discord", "telegram", "whatsapp", "mattermost"] as const;

export type ChatProvider = (typeof CHAT_PROVIDERS)[number];

/**
 * Providers that can carry the generic `chat` channel. WhatsApp has its own
 * channel and billing rate, so it is deliberately excluded here.
 */
export const CHAT_CHANNEL_PROVIDERS = ["slack", "discord", "telegram"] as const;

export type ChatChannelProvider = (typeof CHAT_CHANNEL_PROVIDERS)[number];
