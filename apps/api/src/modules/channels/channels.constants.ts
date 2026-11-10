import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ProviderType } from "../provider/provider-config.entity";

export interface ConnectableChannel {
  readonly key: string;
  readonly providerId: string;
  readonly label: string;
  readonly channel: NotificationChannel;
  readonly providerType: ProviderType;
  readonly description: string;
}

export const CONNECTABLE_CHANNELS: readonly ConnectableChannel[] = [
  {
    key: "slack",
    providerId: "slack",
    label: "Slack",
    channel: NotificationChannel.CHAT,
    providerType: ProviderType.SLACK,
    description: "Post to a channel with a bot token or an incoming webhook.",
  },
  {
    key: "discord",
    providerId: "discord",
    label: "Discord",
    channel: NotificationChannel.CHAT,
    providerType: ProviderType.DISCORD,
    description: "Post through a Discord channel webhook.",
  },
  {
    key: "telegram",
    providerId: "telegram",
    label: "Telegram",
    channel: NotificationChannel.CHAT,
    providerType: ProviderType.TELEGRAM,
    description: "Send messages with a bot created in @BotFather.",
  },
  {
    key: "whatsapp",
    providerId: "whatsapp",
    label: "WhatsApp Business",
    channel: NotificationChannel.WHATSAPP,
    providerType: ProviderType.WHATSAPP,
    description: "Connect your own WhatsApp Business Account through Meta.",
  },
];

export function findConnectableChannel(providerId: string): ConnectableChannel | undefined {
  return CONNECTABLE_CHANNELS.find((candidate) => candidate.providerId === providerId);
}
