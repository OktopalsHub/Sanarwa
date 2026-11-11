import {
  isBillableChannel,
  NotificationChannel,
  type BillingChannel,
} from "../../../common/enums/notification-channel.enum";

export type { BillingChannel };

export type BillingMode = "managed" | "byo";

export const BYO_ELIGIBLE_CHANNELS: BillingChannel[] = [
  NotificationChannel.EMAIL,
  NotificationChannel.SMS,
  NotificationChannel.PUSH,
  NotificationChannel.WHATSAPP,
  NotificationChannel.VOICE,
  NotificationChannel.CHAT,
];

export const MANAGED_ONLY_CHANNELS: BillingChannel[] = [NotificationChannel.IN_APP];

export const MANAGED_CHANNEL_TOKEN_COST: Record<BillingChannel, number> = {
  email: 1,
  push: 0.5,
  in_app: 0.5,
  sms: 24,
  whatsapp: 48,
  voice: 250,
  chat: 1,
};

export const BYO_EVENT_TOKEN_COST = 1;

export const WELCOME_SIGNUP_TOKENS = 3_000;

function isByoEligibleChannel(channel: BillingChannel): boolean {
  return BYO_ELIGIBLE_CHANNELS.includes(channel);
}

function channelTokenCosts(mode: BillingMode): Record<BillingChannel, number> {
  if (mode === "managed") {
    return { ...MANAGED_CHANNEL_TOKEN_COST };
  }
  return Object.fromEntries(
    (Object.keys(MANAGED_CHANNEL_TOKEN_COST) as BillingChannel[]).map((ch) => [
      ch,
      isByoEligibleChannel(ch) ? BYO_EVENT_TOKEN_COST : MANAGED_CHANNEL_TOKEN_COST[ch],
    ]),
  ) as Record<BillingChannel, number>;
}

export function resolveTokenCost(channel: BillingChannel, mode: BillingMode, units = 1): number {
  const effectiveMode = mode === "byo" && !isByoEligibleChannel(channel) ? "managed" : mode;
  const costs = channelTokenCosts(effectiveMode);
  const perUnit = costs[channel] ?? 1;

  if (channel === "voice") {
    const minutes = Math.ceil(Number(units) || 1);
    return Math.ceil(perUnit * Math.max(1, minutes));
  }

  const count = Math.max(0, Math.floor(units));
  return Math.ceil(perUnit * count);
}

export type BillingChannelResolution =
  | { readonly kind: "channel"; readonly channel: BillingChannel }
  | { readonly kind: "unrecognized"; readonly eventType: string };

export function resolveBillingChannel(eventType: string): BillingChannelResolution {
  const key = eventType.toLowerCase();
  if (isBillableChannel(key)) {
    return { kind: "channel", channel: key };
  }
  return { kind: "unrecognized", eventType };
}

function normalizeBillingChannel(eventType: string): BillingChannel {
  const resolution = resolveBillingChannel(eventType);
  return resolution.kind === "channel" ? resolution.channel : NotificationChannel.EMAIL;
}
