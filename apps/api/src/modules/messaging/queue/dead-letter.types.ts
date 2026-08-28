export interface DeadLetterJobData {
  type: "dead_letter";
  originalType: "notification" | "delivery";
  originalId: string;
  tenantId: string;
  failureReason: string;
  failedAt: Date;
  retryCount: number;
  originalJobData: unknown;
  messageData?: unknown;
  deliveryData?: unknown;
}

export interface AlertJobData {
  type: "system_alert";
  alert: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    message: string;
    tenantId: string;
    metadata?: unknown;
    recipients: string[];
  };
  createdAt: Date;
}

export type SystemAlertPayload = AlertJobData["alert"];
