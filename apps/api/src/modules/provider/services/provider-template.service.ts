import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { ProviderCostModel } from "../interfaces/byop.interface";

export interface ProviderTemplate {
  id: string;
  name: string;
  providerId: string;
  channel: NotificationChannel;
  isPopular?: boolean;
  difficulty?: "easy" | "medium" | "hard";
  costModel?: ProviderCostModel;
}

const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  { id: "email.sendgrid", name: "SendGrid", providerId: "sendgrid", channel: NotificationChannel.EMAIL, isPopular: true, difficulty: "easy" },
  { id: "email.mailgun", name: "Mailgun", providerId: "mailgun", channel: NotificationChannel.EMAIL, isPopular: true, difficulty: "easy" },
  { id: "email.ses", name: "Amazon SES", providerId: "ses", channel: NotificationChannel.EMAIL, difficulty: "medium" },
  { id: "sms.twilio", name: "Twilio", providerId: "twilio", channel: NotificationChannel.SMS, isPopular: true, difficulty: "easy" },
  { id: "sms.termii", name: "Termii", providerId: "termii", channel: NotificationChannel.SMS, isPopular: true, difficulty: "easy" },
  { id: "sms.africastalking", name: "Africa's Talking", providerId: "africastalking", channel: NotificationChannel.SMS, difficulty: "easy" },
  { id: "push.fcm", name: "Firebase Cloud Messaging", providerId: "fcm", channel: NotificationChannel.PUSH, isPopular: true, difficulty: "medium" },
  { id: "push.expo", name: "Expo Push", providerId: "expo-push", channel: NotificationChannel.PUSH, difficulty: "easy" },
  { id: "chat.slack", name: "Slack", providerId: "slack", channel: NotificationChannel.CHAT, difficulty: "easy" },
];

@Injectable()
export class ProviderTemplateService {
  getTemplates(channel?: NotificationChannel): ProviderTemplate[] {
    return PROVIDER_TEMPLATES.filter((template) => !channel || template.channel === channel);
  }

  searchTemplates(search: string, channel?: NotificationChannel): ProviderTemplate[] {
    const query = search.trim().toLowerCase();
    return this.getTemplates(channel).filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        template.providerId.toLowerCase().includes(query) ||
        template.id.toLowerCase().includes(query),
    );
  }

  getPopularTemplates(channel?: NotificationChannel): ProviderTemplate[] {
    return this.getTemplates(channel).filter((template) => template.isPopular);
  }

  getTemplate(templateId: string): ProviderTemplate | null {
    return PROVIDER_TEMPLATES.find((template) => template.id === templateId) ?? null;
  }

  validateConfiguration(templateId: string, config: Record<string, unknown>) {
    const template = this.getTemplate(templateId);
    if (!template) {
      return { isValid: false, errors: ["Provider template not found"] };
    }

    const errors: string[] = [];
    if (Object.keys(config).length === 0) {
      errors.push("Provider configuration cannot be empty");
    }

    return { isValid: errors.length === 0, errors };
  }

  getConfigurationHints(templateId: string): string[] {
    const template = this.getTemplate(templateId);
    if (!template) return [];
    return [`Configure credentials for ${template.name}`, "Store provider secrets in encrypted configuration"];
  }

  getRecommendedTemplates(requirements: unknown): ProviderTemplate[] {
    if (!requirements || typeof requirements !== "object") {
      return this.getPopularTemplates();
    }

    const requestedChannel = (requirements as { channel?: NotificationChannel }).channel;
    return this.getPopularTemplates(requestedChannel);
  }
}
