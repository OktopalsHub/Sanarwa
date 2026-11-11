export enum NotificationCenterStatus {
  UNREAD = "unread",
  READ = "read",
  ARCHIVED = "archived",
}

export interface NotificationCenterItem {
  id: string;
  tenantId: string;
  subscriberId: string;
  title: string;
  data: string;
  description?: string;
  channel: string;
  status: NotificationCenterStatus;
  readAt?: Date;
  archivedAt?: Date;
  actionUrl?: string;
  actionLabel?: string;
  imageUrl?: string;
  metadata?: Record<string, any>;
  templateId?: string;
  messageId?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The center has no persisted list on its own; items are views over
 * in_app_notifications. Kept as the wire shape for the SDK-facing routes
 * and the /notifications WS gateway.
 */
export function toItem(row: {
  id: string;
  tenantId: string;
  subscriberId?: string | null;
  title: string;
  message: string;
  channel: string;
  readAt?: Date | null;
  archived: boolean;
  archivedAt?: Date | null;
  actionUrl?: string | null;
  actions?: Array<{ id: string; label: string; url?: string }> | null;
  avatar?: string | null;
  metadata?: Record<string, any> | null;
  data?: Record<string, any> | null;
  templateId?: string | null;
  messageId?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): NotificationCenterItem {
  const mergedMetadata = { ...row.data, ...row.metadata };

  return {
    id: row.id,
    tenantId: row.tenantId,
    subscriberId: row.subscriberId ?? "",
    title: row.title,
    data: row.message,
    description:
      typeof mergedMetadata?.description === "string" ? mergedMetadata.description : undefined,
    channel: row.channel,
    status: row.archived
      ? NotificationCenterStatus.ARCHIVED
      : row.readAt
        ? NotificationCenterStatus.READ
        : NotificationCenterStatus.UNREAD,
    readAt: row.readAt ?? undefined,
    archivedAt: row.archivedAt ?? undefined,
    actionUrl: row.actionUrl ?? undefined,
    actionLabel: row.actions?.[0]?.label,
    imageUrl: row.avatar ?? undefined,
    metadata: Object.keys(mergedMetadata ?? {}).length > 0 ? mergedMetadata : undefined,
    templateId: row.templateId ?? undefined,
    messageId: row.messageId ?? undefined,
    expiresAt: row.expiresAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
