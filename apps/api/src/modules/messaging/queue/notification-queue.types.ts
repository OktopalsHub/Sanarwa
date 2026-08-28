import { MessagePriority as Priority } from "../message.entity";

export interface NotificationJobData {
  notificationId: string;
  tenantId: string;
  priority: Priority;
  scheduledAt?: Date;
  retryCount?: number;
}

export interface DeliveryJobData {
  notificationId: string;
  deliveryId: string;
  tenantId: string;
  channel: string;
  providerId: string;
  recipient: string;
  templateData: Record<string, any>;
  retryCount?: number;
}

export interface DeadLetterJobData {
  type: string;
  originalType: "notification" | "delivery";
  originalId: string;
  tenantId: string;
  failureReason: string;
  failedAt: Date;
  retryCount: number;
  originalJobData: any;
  messageData?: any;
  deliveryData?: any;
}

export interface AlertJobData {
  type: string;
  alert: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    tenantId: string;
    metadata?: any;
    recipients: string[];
  };
  createdAt: Date;
}
