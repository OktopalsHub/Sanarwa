import { Module } from "@nestjs/common";
import { SlackProvider } from "./providers/slack.provider";
import { DiscordProvider } from "./providers/discord.provider";
import { TelegramProvider } from "./providers/telegram.provider";
import { WhatsAppProvider } from "./providers/whatsapp.provider";

/**
 * Chat is BYOP-only: every tenant supplies their own Slack, Discord, Telegram
 * or WhatsApp Business credentials. These instances exist so the orchestrator
 * has a registered transport and a config validator; they carry no platform
 * credentials and are never used as a managed fallback.
 */
@Module({
  providers: [
    { provide: SlackProvider, useFactory: () => new SlackProvider({}) },
    { provide: DiscordProvider, useFactory: () => new DiscordProvider({}) },
    { provide: TelegramProvider, useFactory: () => new TelegramProvider({}) },
    { provide: WhatsAppProvider, useFactory: () => new WhatsAppProvider({}) },
  ],
  exports: [SlackProvider, DiscordProvider, TelegramProvider, WhatsAppProvider],
})
export class ChatModule {}
