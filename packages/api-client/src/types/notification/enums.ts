// Enums matching backend
export enum NotificationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  CANCELLED = "cancelled",
  READ = "read",
}

export enum NotificationType {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  SUCCESS = "success",
  SYSTEM = "system",
  USER_ACTION = "user_action",
  MARKETING = "marketing",
}

export enum NotificationChannel {
  EMAIL = "email",
  SMS = "sms",
  PUSH = "push",
  WHATSAPP = "whatsapp",
  IN_APP = "in_app",
  WEBHOOK = "webhook",
}

export enum NotificationPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export enum Priority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

