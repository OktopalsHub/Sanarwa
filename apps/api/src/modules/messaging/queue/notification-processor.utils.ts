import { MessagePriority as Priority } from "../message.entity";

export function getRecipientAddress(recipient: Record<string, unknown> | object, channel: string): string | null {
  const r = recipient as Record<string, unknown>;
  switch (channel) {
    case "email":
      return (r.email as string) || null;
    case "sms":
      return (r.phone as string) || null;
    case "whatsapp":
      return (r.whatsappNumber as string) || null;
    case "push":
      return (r.deviceToken as string) || null;
    case "in_app":
      return (r.userId as string) || null;
    default:
      return (r.id as string) || null;
  }
}

export function getPriorityValue(priority: Priority): number {
  switch (priority) {
    case Priority.URGENT:
      return 10;
    case Priority.HIGH:
      return 5;
    case Priority.NORMAL:
      return 1;
    case Priority.LOW:
      return -5;
    default:
      return 1;
  }
}

export function getAlertPriority(severity: string): number {
  switch (severity) {
    case "critical":
      return 20;
    case "high":
      return 15;
    case "medium":
      return 5;
    case "low":
      return 1;
    default:
      return 5;
  }
}
