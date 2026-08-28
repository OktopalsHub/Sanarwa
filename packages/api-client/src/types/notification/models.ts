import { NotificationChannel, NotificationPriority, NotificationStatus, NotificationType, Priority } from "./enums";

export interface Recipient {
  id: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  whatsappNumber?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationAction {
  id: string;
  label: string;
  url?: string;
  action?: string;
  style?: "primary" | "secondary" | "danger";
}

// Main notification interface (from notification module)
export interface Notification {
  id: string;
  tenantId: string;
  templateId?: string;
  channels: NotificationChannel[];
  recipients: Recipient[];
  data: Record<string, any>;
  status: NotificationStatus;
  priority: Priority;
  scheduledAt?: Date;
  subject?: string;
  content?: string;
  metadata?: Record<string, any>;
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  deliveries?: NotificationDelivery[];
}

// In-app notification interface (from notifications module)
export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  status: NotificationStatus;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
  templateId?: string;
  category?: string;
  actionUrl?: string;
  actions?: NotificationAction[];
  scheduledAt?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  expiresAt?: Date;
  userId?: string;
  tenantId: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  user?: any; // Will be typed in auth.ts
  tenant?: any; // Will be typed in tenant.ts
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  status: NotificationStatus;
  providerId?: string;
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;

  // Relationships
  notification?: Notification;
}

// Subscription management
export interface NotificationSubscription {
  id: string;
  userId: string;
  tenantId: string;
  channel: NotificationChannel;
  category?: string;
  isEnabled: boolean;
  preferences?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Queue management
export interface NotificationQueue {
  id: string;
  tenantId: string;
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  scheduledAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  retryCount: number;
  maxRetries: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
