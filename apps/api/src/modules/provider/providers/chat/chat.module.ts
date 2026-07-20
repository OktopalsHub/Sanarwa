import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SlackProvider } from './providers/slack.provider';
import { DiscordProvider } from './providers/discord.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    SlackProvider,
    DiscordProvider,
    WhatsAppProvider,
  ],
  exports: [
    SlackProvider,
    DiscordProvider,
    WhatsAppProvider,
  ],
})
export class ChatModule { }