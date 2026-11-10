/**
 * The single dead-letter / alert job payload contract. Both the queue service
 * (producer) and the dead-letter processor (consumer) import this file —
 * naming drift between copies was the reason dead letters went unreclaimed.
 */

export interface DeadLetterJobData {
  type: "dead_letter";
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
  type: "system_alert";
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
