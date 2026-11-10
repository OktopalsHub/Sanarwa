import { ChatProvider } from "../../common/enums/chat-provider.enum";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { MessageRecipientDto } from "./dto/send-message.dto";

export function resolveAddress(
  recipient: MessageRecipientDto,
  channel: NotificationChannel,
  chatProvider?: ChatProvider,
): string | null {
  switch (channel) {
    case NotificationChannel.EMAIL:
      return recipient.email ?? null;
    case NotificationChannel.SMS:
      return recipient.phone ?? null;
    case NotificationChannel.PUSH:
      return recipient.deviceToken ?? recipient.userId ?? recipient.id;
    case NotificationChannel.WHATSAPP:
      return recipient.whatsappNumber ?? recipient.phone ?? null;
    case NotificationChannel.IN_APP:
      return recipient.userId ?? recipient.id;
    case NotificationChannel.CHAT:
      return resolveChatAddress(recipient, chatProvider);
    case NotificationChannel.WEBHOOK:
    case NotificationChannel.VOICE:
      return recipient.id;
    default:
      return null;
  }
}

function resolveChatAddress(
  recipient: MessageRecipientDto,
  chatProvider?: ChatProvider,
): string | null {
  switch (chatProvider ?? "slack") {
    case "slack":
      return recipient.slackChannel ?? recipient.slackWebhookUrl ?? recipient.chatAddress ?? null;
    case "discord":
      return recipient.discordWebhookUrl ?? recipient.chatAddress ?? null;
    case "telegram":
      return recipient.telegramChatId ?? recipient.chatAddress ?? null;
    default:
      return recipient.chatAddress ?? null;
  }
}
