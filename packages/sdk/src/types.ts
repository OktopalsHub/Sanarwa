import type { TransportChannel, TransportSendRequest, TransportSendResponse } from "./transport";

export type NotificationChannel = TransportChannel;

export type NotificationPriority = "low" | "normal" | "high";

/**
 * The single send contract, matching `POST /notifications/send`
 * (apps/api/src/modules/notifications/.../notification-transport.controller.ts).
 *
 * The API takes a flat body: `to` + `channel` + `message`, not nested recipients.
 */
export type NotificationRequest = TransportSendRequest;

export interface NotificationResponse extends TransportSendResponse {}

export interface BulkNotificationRequest {
  notifications: NotificationRequest[];
  batchId?: string;
}

export interface BulkNotificationResponse {
  batchId: string;
  status: string;
  results: NotificationResponse[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}

export interface TransportHealth {
  status: string;
  timestamp: string;
  services?: Record<string, string>;
}

export interface WhatsAppTemplateParameter {
  type: string;
  text: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  name?: string;
  data?: string;
  subject?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Template {
  id: string;
  tenantId: string;
  name?: string;
  description?: string;
  channel: NotificationChannel;
  subject?: string;
  data?: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationCenterItem {
  id: string;
  tenantId: string;
  subscriberId: string;
  title: string;
  data: string;
  description?: string;
  channel: string;
  status: string;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  templateId?: string;
  messageId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  readAt?: string;
  archivedAt?: string;
}
