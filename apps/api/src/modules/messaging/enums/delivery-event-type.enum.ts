export enum DeliveryEventType {
  QUEUED = "queued",
  SENT = "sent",
  DELIVERED = "delivered",
  DEFERRED = "deferred",
  BOUNCED = "bounced",
  COMPLAINED = "complained",
  OPENED = "opened",
  CLICKED = "clicked",
  UNSUBSCRIBED = "unsubscribed",
  DROPPED = "dropped",
}

export const BOUNCE_TYPES = ["hard", "soft"] as const;

export type BounceType = (typeof BOUNCE_TYPES)[number];
