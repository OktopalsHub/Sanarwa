export { SlackProvider } from "./slack.provider";
export { DiscordProvider } from "./discord.provider";
export { WhatsAppProvider } from "./whatsapp.provider";
export { MattermostProvider } from "./mattermost.provider";

export const CHAT_PROVIDERS = ["slack", "discord", "whatsapp", "mattermost"] as const;

export type ChatProviderType = (typeof CHAT_PROVIDERS)[number];
