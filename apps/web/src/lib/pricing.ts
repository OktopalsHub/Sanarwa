/** PAYG tokens. Dual shelves (NGN ≠ USD×FX). Managed vs BYO use different list rates. */

export type ChannelId = "email" | "sms" | "push" | "whatsapp" | "in_app" | "voice";

export type CurrencyCode = "USD" | "NGN";

export type BillingMode = "managed" | "byo";

export interface TokenPackage {
  id: string;
  tokens: number;
  priceUsd: number;
  priceNgn: number;
  pricePerTokenUsd: number;
  pricePerTokenNgn: number;
  savingsPercent: number;
}

/** BYO-eligible — customer brings provider. Keep in sync with apps/api/.../token-pricing.ts */
export const BYO_ELIGIBLE_CHANNELS: ChannelId[] = ["email", "sms", "push", "whatsapp", "voice"];

/** Always Sanarwa-managed (in-app / realtime). */
export const MANAGED_ONLY_CHANNELS: ChannelId[] = ["in_app"];

/** Managed — Sanarwa pays delivery. */
export const MANAGED_CHANNEL_TOKEN_COST: Record<ChannelId, number> = {
  email: 1,
  push: 0.5,
  in_app: 0.5,
  sms: 24,
  whatsapp: 48,
  voice: 250,
};

/** Novu-style BYO: 1 token = 1 event on any BYO channel. */
export const BYO_EVENT_TOKEN_COST = 1;

/** @deprecated Use channelTokenCost(channel, mode) */
export const CHANNEL_TOKEN_COST = MANAGED_CHANNEL_TOKEN_COST;

export function isByoEligibleChannel(channel: ChannelId): boolean {
  return BYO_ELIGIBLE_CHANNELS.includes(channel);
}

export function channelTokenCost(channel: ChannelId, mode: BillingMode = "managed"): number {
  if (mode === "byo" && isByoEligibleChannel(channel)) {
    return BYO_EVENT_TOKEN_COST;
  }
  return MANAGED_CHANNEL_TOKEN_COST[channel];
}

export function channelTokenCosts(mode: BillingMode): Record<ChannelId, number> {
  return Object.fromEntries(
    (Object.keys(MANAGED_CHANNEL_TOKEN_COST) as ChannelId[]).map((ch) => [
      ch,
      channelTokenCost(ch, mode),
    ]),
  ) as Record<ChannelId, number>;
}

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  whatsapp: "WhatsApp",
  in_app: "In-app",
  voice: "Voice (per min)",
};

export const CHANNEL_UNIT_LABEL: Record<ChannelId, string> = {
  email: "sends",
  sms: "sends",
  push: "sends",
  whatsapp: "sends",
  in_app: "sends",
  voice: "minutes",
};

export const USD_TO_NGN = 1600;

/** Free tokens for every new workspace. Keep in sync with apps/api/.../token-pricing.ts */
export const WELCOME_SIGNUP_TOKENS = 3_000;

/** Managed list: $1 / ₦1,000 → 3,000 tokens (email anchor). */
export const MANAGED_LIST_TOKENS = 3_000;
export const MANAGED_LIST_PRICE_USD = 1;
export const MANAGED_LIST_PRICE_NGN = 1_000;

/** BYO list (Novu-style): $10 → 12,500 events · $1 → 1,250 events. */
export const BYO_LIST_EVENTS = 12_500;
export const BYO_LIST_PRICE_USD = 10;
export const BYO_LIST_PRICE_NGN = 10_000;
export const BYO_EVENTS_PER_USD = BYO_LIST_EVENTS / BYO_LIST_PRICE_USD;
export const BYO_EVENTS_PER_NGN = BYO_LIST_EVENTS / BYO_LIST_PRICE_NGN;

export const BASE_TOKEN_PRICE_USD = MANAGED_LIST_PRICE_USD / MANAGED_LIST_TOKENS;
export const BASE_TOKEN_PRICE_NGN = MANAGED_LIST_PRICE_NGN / MANAGED_LIST_TOKENS;

export const TOKEN_PACKAGES_USD: TokenPackage[] = [
  {
    id: "usd-3000",
    tokens: 3_000,
    priceUsd: 1,
    priceNgn: 0,
    pricePerTokenUsd: 1 / 3_000,
    pricePerTokenNgn: 0,
    savingsPercent: 0,
  },
  {
    id: "usd-15000",
    tokens: 15_000,
    priceUsd: 5,
    priceNgn: 0,
    pricePerTokenUsd: 5 / 15_000,
    pricePerTokenNgn: 0,
    savingsPercent: 0,
  },
  {
    id: "usd-60000",
    tokens: 60_000,
    priceUsd: 20,
    priceNgn: 0,
    pricePerTokenUsd: 20 / 60_000,
    pricePerTokenNgn: 0,
    savingsPercent: 0,
  },
  {
    id: "usd-300000",
    tokens: 300_000,
    priceUsd: 90,
    priceNgn: 0,
    pricePerTokenUsd: 90 / 300_000,
    pricePerTokenNgn: 0,
    savingsPercent: 10,
  },
];

export const TOKEN_PACKAGES_NGN: TokenPackage[] = [
  {
    id: "ngn-3000",
    tokens: 3_000,
    priceUsd: 0,
    priceNgn: 1_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 1_000 / 3_000,
    savingsPercent: 0,
  },
  {
    id: "ngn-15000",
    tokens: 15_000,
    priceUsd: 0,
    priceNgn: 5_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 5_000 / 15_000,
    savingsPercent: 0,
  },
  {
    id: "ngn-60000",
    tokens: 60_000,
    priceUsd: 0,
    priceNgn: 20_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 20_000 / 60_000,
    savingsPercent: 0,
  },
  {
    id: "ngn-300000",
    tokens: 300_000,
    priceUsd: 0,
    priceNgn: 90_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 90_000 / 300_000,
    savingsPercent: 10,
  },
];

/** BYO event packs — $1 / ₦1,000 → 1,250 events (not managed token shelf). */
export const BYO_EVENT_PACKAGES_USD: TokenPackage[] = [
  {
    id: "byo-usd-1250",
    tokens: 1_250,
    priceUsd: 1,
    priceNgn: 0,
    pricePerTokenUsd: 1 / 1_250,
    pricePerTokenNgn: 0,
    savingsPercent: 0,
  },
  {
    id: "byo-usd-6250",
    tokens: 6_250,
    priceUsd: 5,
    priceNgn: 0,
    pricePerTokenUsd: 5 / 6_250,
    pricePerTokenNgn: 0,
    savingsPercent: 0,
  },
  {
    id: "byo-usd-25000",
    tokens: 25_000,
    priceUsd: 20,
    priceNgn: 0,
    pricePerTokenUsd: 20 / 25_000,
    pricePerTokenNgn: 0,
    savingsPercent: 0,
  },
  {
    id: "byo-usd-123750",
    tokens: 123_750,
    priceUsd: 90,
    priceNgn: 0,
    pricePerTokenUsd: 90 / 123_750,
    pricePerTokenNgn: 0,
    savingsPercent: 10,
  },
];

export const BYO_EVENT_PACKAGES_NGN: TokenPackage[] = [
  {
    id: "byo-ngn-1250",
    tokens: 1_250,
    priceUsd: 0,
    priceNgn: 1_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 1_000 / 1_250,
    savingsPercent: 0,
  },
  {
    id: "byo-ngn-6250",
    tokens: 6_250,
    priceUsd: 0,
    priceNgn: 5_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 5_000 / 6_250,
    savingsPercent: 0,
  },
  {
    id: "byo-ngn-25000",
    tokens: 25_000,
    priceUsd: 0,
    priceNgn: 20_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 20_000 / 25_000,
    savingsPercent: 0,
  },
  {
    id: "byo-ngn-123750",
    tokens: 123_750,
    priceUsd: 0,
    priceNgn: 90_000,
    pricePerTokenUsd: 0,
    pricePerTokenNgn: 90_000 / 123_750,
    savingsPercent: 10,
  },
];

export const TOKEN_PACKAGES = TOKEN_PACKAGES_USD;

export function packagesForCurrency(
  currency: CurrencyCode,
  mode: BillingMode = "managed",
): TokenPackage[] {
  if (mode === "byo") {
    return currency === "NGN" ? BYO_EVENT_PACKAGES_NGN : BYO_EVENT_PACKAGES_USD;
  }
  return currency === "NGN" ? TOKEN_PACKAGES_NGN : TOKEN_PACKAGES_USD;
}

export function usdToNgn(usd: number): number {
  return usd * USD_TO_NGN;
}

export function ngnToUsd(ngn: number): number {
  return ngn / USD_TO_NGN;
}

export function tokensForSends(
  channel: ChannelId,
  sends: number,
  mode: BillingMode = "managed",
): number {
  const cost = channelTokenCost(channel, mode);
  return Math.ceil(cost * Math.max(0, Math.floor(sends)));
}

export function sendsFromTokens(
  channel: ChannelId,
  tokens: number,
  mode: BillingMode = "managed",
): number {
  const cost = channelTokenCost(channel, mode);
  if (cost <= 0) return 0;
  return Math.floor(Math.max(0, tokens) / cost);
}

/** BYO: 1 token = 1 event (flat). */
export function eventsFromSpend(spend: number, currency: CurrencyCode): number {
  if (spend <= 0) return 0;
  const rate = currency === "NGN" ? BYO_EVENTS_PER_NGN : BYO_EVENTS_PER_USD;
  return Math.floor(spend * rate);
}

export function getTokenUnitPrice(
  tokens: number,
  currency: CurrencyCode,
  mode: BillingMode = "managed",
): number {
  const packs = packagesForCurrency(currency, mode);
  if (tokens <= 0) {
    if (mode === "byo") {
      return currency === "NGN" ? 1 / BYO_EVENTS_PER_NGN : 1 / BYO_EVENTS_PER_USD;
    }
    return currency === "NGN" ? BASE_TOKEN_PRICE_NGN : BASE_TOKEN_PRICE_USD;
  }
  const fit = packs.find((p) => p.tokens >= tokens) ?? packs[packs.length - 1]!;
  return currency === "NGN" ? fit.pricePerTokenNgn : fit.pricePerTokenUsd;
}

export function getTokenUnitPriceUsd(tokenAmount: number): number {
  return getTokenUnitPrice(tokenAmount, "USD");
}

export function tokensFromSpend(
  spend: number,
  currency: CurrencyCode,
  mode: BillingMode = "managed",
): number {
  if (spend <= 0) return 0;

  if (mode === "byo") {
    const packs = packagesForCurrency(currency, "byo");
    const exact = packs.find((p) =>
      currency === "NGN" ? p.priceNgn === spend : p.priceUsd === spend,
    );
    if (exact) return exact.tokens;
    return eventsFromSpend(spend, currency);
  }

  const packs = packagesForCurrency(currency, "managed");
  const base = currency === "NGN" ? BASE_TOKEN_PRICE_NGN : BASE_TOKEN_PRICE_USD;
  let tokens = Math.floor(spend / base);
  const unit = getTokenUnitPrice(tokens, currency, mode);
  tokens = Math.floor(spend / unit);

  const exact = packs.find((p) =>
    currency === "NGN" ? p.priceNgn === spend : p.priceUsd === spend,
  );
  if (exact) return exact.tokens;

  return Math.max(0, tokens);
}

export function tokensFromSpendUsd(spendUsd: number): number {
  return tokensFromSpend(spendUsd, "USD");
}

export function bestPackageForTokens(
  tokensNeeded: number,
  currency: CurrencyCode,
  mode: BillingMode = "managed",
): TokenPackage | null {
  if (tokensNeeded <= 0) return null;
  const packs = packagesForCurrency(currency, mode);
  return packs.find((p) => p.tokens >= tokensNeeded) ?? packs[packs.length - 1] ?? null;
}

export function packPrice(pkg: TokenPackage, currency: CurrencyCode): number {
  return currency === "NGN" ? pkg.priceNgn : pkg.priceUsd;
}

export function packUnitPrice(pkg: TokenPackage, currency: CurrencyCode): number {
  return currency === "NGN" ? pkg.pricePerTokenNgn : pkg.pricePerTokenUsd;
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  if (currency === "NGN") {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: amount >= 1 ? 0 : 2,
  }).format(amount);
}

export function formatTokens(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatUsd(amount: number): string {
  return formatMoney(amount, "USD");
}
