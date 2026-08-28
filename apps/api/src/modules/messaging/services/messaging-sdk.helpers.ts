import { MessageDeliveryStatus } from "../message-delivery.entity";
import { MessageChannel, MessageStatus } from "../message.entity";
import { DeliveryReport } from "../interfaces/messaging-sdk.interface";

export function mapToDeliveryReport(delivery: any): DeliveryReport {
  return {
    id: delivery.id,
    channel: delivery.channel,
    recipient: delivery.recipient,
    status: delivery.status,
    providerId: delivery.providerId,
    providerMessageId: delivery.providerMessageId,
    sentAt: delivery.sentAt,
    deliveredAt: delivery.deliveredAt,
    openedAt: delivery.openedAt,
    clickedAt: delivery.clickedAt,
    errorMessage: delivery.errorMessage,
    retryCount: delivery.retryCount,
  };
}

export function calculateEstimatedDelivery(
  channels: MessageChannel[],
  scheduledAt?: Date,
): Date {
  const baseTime = scheduledAt || new Date();
  const processingTime = channels.includes(MessageChannel.EMAIL) ? 30000 : 5000;
  return new Date(baseTime.getTime() + processingTime);
}

export function calculateCompletedAt(deliveries: any[]): Date | undefined {
  const lastDelivery = deliveries
    .filter(
      (d) =>
        d.status === MessageDeliveryStatus.DELIVERED || d.status === MessageDeliveryStatus.FAILED,
    )
    .toSorted((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return lastDelivery?.deliveredAt || lastDelivery?.createdAt;
}

export function calculateChannelStats(messages: any[], filterChannel?: MessageChannel) {
  const channelMap = new Map<string, { sent: number; delivered: number; failed: number }>();

  messages.forEach((message) => {
    message.channels.forEach((channel: MessageChannel) => {
      if (filterChannel && channel !== filterChannel) return;

      if (!channelMap.has(channel)) {
        channelMap.set(channel, { sent: 0, delivered: 0, failed: 0 });
      }

      const stats = channelMap.get(channel)!;
      stats.sent++;

      const channelDeliveries = message.deliveries.filter((d: any) => d.channel === channel);
      if (channelDeliveries.some((d: any) => d.status === MessageDeliveryStatus.DELIVERED)) {
        stats.delivered++;
      } else if (channelDeliveries.some((d: any) => d.status === MessageDeliveryStatus.FAILED)) {
        stats.failed++;
      }
    });
  });

  return Array.from(channelMap.entries()).map(([channel, stats]) => ({
    channel: channel as MessageChannel,
    sent: stats.sent,
    delivered: stats.delivered,
    failed: stats.failed,
    deliveryRate: stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0,
  }));
}

export function calculateTimeSeriesData(messages: any[], groupBy: "day" | "week" | "month") {
  const timeMap = new Map<string, { sent: number; delivered: number; failed: number }>();

  messages.forEach((message) => {
    const date = formatDateByGrouping(message.createdAt, groupBy);
    if (!timeMap.has(date)) {
      timeMap.set(date, { sent: 0, delivered: 0, failed: 0 });
    }

    const stats = timeMap.get(date)!;
    stats.sent++;

    if (message.deliveries.some((d: any) => d.status === MessageDeliveryStatus.DELIVERED)) {
      stats.delivered++;
    } else if (message.status === MessageStatus.FAILED) {
      stats.failed++;
    }
  });

  return Array.from(timeMap.entries()).map(([date, stats]) => ({
    date,
    sent: stats.sent,
    delivered: stats.delivered,
    failed: stats.failed,
  }));
}

function formatDateByGrouping(date: Date, groupBy: "day" | "week" | "month"): string {
  const d = new Date(date);
  switch (groupBy) {
    case "day":
      return d.toISOString().split("T")[0];
    case "week": {
      const week = Math.ceil(d.getDate() / 7);
      return `${d.getFullYear()}-${d.getMonth() + 1}-W${week}`;
    }
    case "month":
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    default:
      return d.toISOString().split("T")[0];
  }
}
