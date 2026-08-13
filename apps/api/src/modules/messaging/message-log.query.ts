export type MessageLogQuery = {
  channel?: string;
  status?: string;
  projectId?: string;
  q?: string;
  startDate?: string;
  endDate?: string;
};

type FilterQueryBuilder = {
  where: (sql: string, params?: object) => unknown;
  andWhere: (sql: string, params?: object) => unknown;
};

export function applyMessageLogFilters(
  qb: FilterQueryBuilder,
  query: MessageLogQuery,
  tenantId?: string,
) {
  if (tenantId) {
    qb.where('log.tenantId = :tenantId', { tenantId });
  }
  if (query.channel) {
    qb.andWhere('log.channel = :channel', { channel: query.channel });
  }
  if (query.status) {
    qb.andWhere('log.status = :status', { status: query.status });
  }
  if (query.projectId) {
    qb.andWhere('log.projectId = :projectId', { projectId: query.projectId });
  }
  if (query.q) {
    qb.andWhere('(log.to ILIKE :q OR log.trackingId ILIKE :q)', {
      q: `%${query.q}%`,
    });
  }
  if (query.startDate) {
    qb.andWhere('log.createdAt >= :startDate', {
      startDate: new Date(query.startDate),
    });
  }
  if (query.endDate) {
    qb.andWhere('log.createdAt <= :endDate', {
      endDate: new Date(query.endDate),
    });
  }
}

export function mapLogsToMessageListRecords(
  logs: Array<{
    id: string;
    trackingId: string;
    channel: string;
    to: string;
    status: string;
    projectId: string;
    metadata?: { messageId?: string };
    error?: string;
    createdAt: Date;
    sentAt?: Date;
    deliveredAt?: Date;
  }>,
  messages: Array<{ id: string; subject?: string | null; content?: string | null }>,
) {
  const messageById = new Map(messages.map((message) => [message.id, message]));
  return logs.map((log) => {
    const message = log.metadata?.messageId
      ? messageById.get(log.metadata.messageId)
      : undefined;
    return {
      id: log.id,
      trackingId: log.trackingId,
      channel: log.channel,
      to: log.to,
      status: log.status,
      projectId: log.projectId,
      messageId: log.metadata?.messageId,
      subject: message?.subject ?? null,
      hasContent: Boolean(message?.content || message?.subject),
      error: log.error,
      createdAt: log.createdAt,
      sentAt: log.sentAt,
      deliveredAt: log.deliveredAt,
    };
  });
}
