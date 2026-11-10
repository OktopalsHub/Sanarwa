/**
 * Re-exports the workspace single source of truth for channel vocabulary.
 * Do not re-declare anything in this file — import from @sanarwa/shared-types
 * instead.
 */
export {
  NotificationChannel,
  BILLABLE_CHANNELS,
  CoreNotificationChannels,
  DELIVERABLE_CHANNELS,
  DELIVERABLE_CHANNELS_LIST,
  isBillableChannel,
} from "@sanarwa/shared-types";
export type { BillingChannel, DeliverableSendChannel } from "@sanarwa/shared-types";

import { NotificationChannel, CoreNotificationChannels } from "@sanarwa/shared-types";

/** All known channel names (kept for back-compat with older config/validation). */
export const AllNotificationChannels = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.IN_APP,
  NotificationChannel.VOICE,
  NotificationChannel.WEBHOOK,
  NotificationChannel.CHAT,
] as const;

/** Channels that make sense on the public send endpoint. */
export const PUBLIC_SEND_CHANNELS = CoreNotificationChannels;
