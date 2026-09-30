export type BillingChannel = "email" | "sms" | "push" | "whatsapp" | "in_app" | "voice";

export type BillingMode = "managed" | "byo";

/** BYO-eligible channels — customer brings provider credentials. */
export const BYO_ELIGIBLE_CHANNELS: BillingChannel[] = [
  "email",
  "sms",
  "push",
  "whatsapp",
  "voice",
];

/** Always Sanarwa-managed — not BYO (Novu-style in-app / realtime). */
export const MANAGED_ONLY_CHANNELS: BillingChannel[] = ["in_app"];

/** Sanarwa pays delivery — per-channel weights include provider COGS. */
export const MANAGED_CHANNEL_TOKEN_COST: Record<BillingChannel, number> = {
  email: 1,
  push: 0.5,
  in_app: 0.5,
  sms: 24,
  whatsapp: 48,
  voice: 250,
};

/** Novu-style BYO: 1 token = 1 event, any BYO channel. */
export const BYO_EVENT_TOKEN_COST = 1;

/** Free tokens granted when a new workspace is created. */
export const WELCOME_SIGNUP_TOKENS = 3_000;

export function isByoEligibleChannel(channel: BillingChannel): boolean {
  return BYO_ELIGIBLE_CHANNELS.includes(channel);
}

export function channelTokenCosts(mode: BillingMode): Record<BillingChannel, number> {
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

export function normalizeBillingChannel(eventType: string): BillingChannel {
  const key = eventType.toLowerCase();
  if (key in MANAGED_CHANNEL_TOKEN_COST) {
    return key as BillingChannel;
  }
  return "email";
}
