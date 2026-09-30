"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/compat/next-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useCheckoutCurrency } from "@/hooks/use-checkout-currency";
import { SanarwaMark, SanarwaWordmark } from "@sanarwa/assets";
import {
  BYO_ELIGIBLE_CHANNELS,
  BYO_EVENTS_PER_NGN,
  BYO_EVENTS_PER_USD,
  MANAGED_LIST_TOKENS,
  MANAGED_ONLY_CHANNELS,
  WELCOME_SIGNUP_TOKENS,
  CHANNEL_LABELS,
  CHANNEL_UNIT_LABEL,
  channelTokenCosts,
  type BillingMode,
  type ChannelId,
  type CurrencyCode,
  formatMoney,
  formatTokens,
  packagesForCurrency,
  packPrice,
  sendsFromTokens,
  tokensFromSpend,
} from "@/lib/pricing";

const MANAGED_CHANNELS = Object.keys(channelTokenCosts("managed")) as ChannelId[];

const CHANNEL_LOGOS: Record<ChannelId, { src: string; alt: string }> = {
  email: { src: "/channels/email.svg", alt: "Email" },
  sms: { src: "/channels/sms.svg", alt: "SMS" },
  whatsapp: { src: "/channels/whatsapp.svg", alt: "WhatsApp" },
  push: { src: "/channels/push.svg", alt: "Push" },
  in_app: { src: "/channels/in_app.svg", alt: "In-app" },
  voice: { src: "/channels/voice.svg", alt: "Voice" },
};

function SiteHeader({ active }: { active: "home" | "pricing" }) {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-rule)] bg-[var(--color-paper)]/90 backdrop-blur-md">
      <div className="relative mx-auto grid h-11 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-4">
        <Link href="/" className="justify-self-start" aria-label="Sanarwa home">
          <SanarwaWordmark markClassName="size-5 text-[var(--hm-accent)]" />
        </Link>
        <nav className="flex items-center gap-4 text-xs">
          <Link
            href="/"
            className={
              active === "home"
                ? "font-medium text-[var(--hm-accent)]"
                : "text-[var(--color-ink-2)] hover:text-[var(--hm-accent)]"
            }
          >
            Home
          </Link>
          <Link
            href="/pricing"
            className={
              active === "pricing"
                ? "font-medium text-[var(--hm-accent)]"
                : "text-[var(--color-ink-2)] hover:text-[var(--hm-accent)]"
            }
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center justify-end gap-2">
          <ThemeToggle />
          <Button
            asChild
            size="sm"
            className="h-7 px-2.5 text-xs bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90"
          >
            <Link href="/register">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function PricingPage() {
  const {
    currency: checkoutCurrency,
    setCurrency: setCheckoutCurrency,
    isReady,
  } = useCheckoutCurrency();
  const currency = (isReady ? checkoutCurrency : "USD") as CurrencyCode;
  const [spendInput, setSpendInput] = useState(1);
  const [billingMode, setBillingMode] = useState<BillingMode>("managed");
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>("email");

  useEffect(() => {
    setSpendInput(currency === "NGN" ? 1000 : 1);
  }, [currency]);

  const packs = packagesForCurrency(currency, billingMode);

  const tokens = useMemo(
    () => tokensFromSpend(spendInput, currency, billingMode),
    [spendInput, currency, billingMode],
  );

  const sendsByChannel = useMemo(
    () =>
      Object.fromEntries(
        MANAGED_CHANNELS.map((id) => [id, sendsFromTokens(id, tokens, "managed")]),
      ) as Record<ChannelId, number>,
    [tokens],
  );

  const selectedSends = sendsByChannel[selectedChannel];
  const selectedLogo = CHANNEL_LOGOS[selectedChannel];

  const switchCurrency = () => {
    const next: CurrencyCode = currency === "NGN" ? "USD" : "NGN";
    setCheckoutCurrency(next);
    setSpendInput(next === "NGN" ? 1000 : 1);
  };

  const budgetLabel = formatMoney(spendInput, currency);
  const unitLabel = billingMode === "byo" ? "events" : "tokens";

  const anchorHint =
    billingMode === "byo"
      ? currency === "NGN"
        ? `BYO: ₦1,000 ≈ ${formatTokens(Math.floor(1000 * BYO_EVENTS_PER_NGN))} events`
        : `$1 ≈ ${formatTokens(Math.floor(BYO_EVENTS_PER_USD))} events`
      : currency === "NGN"
        ? `List rate: ₦1,000 → ${formatTokens(MANAGED_LIST_TOKENS)} tokens`
        : `List rate: $1 → ${formatTokens(MANAGED_LIST_TOKENS)} tokens`;

  const byoChannelLabels = BYO_ELIGIBLE_CHANNELS.map((id) => CHANNEL_LABELS[id]).join(", ");

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink-2)]">
      <SiteHeader active="pricing" />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
              Pay as you go
            </h1>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              New accounts include {formatTokens(WELCOME_SIGNUP_TOKENS)} free tokens. Enter any
              amount below.
            </p>
          </div>
          <button
            type="button"
            onClick={switchCurrency}
            className="text-[11px] text-[var(--color-muted)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
          >
            Switch to {currency === "NGN" ? "USD" : "NGN"}
          </button>
        </div>

        <section
          id="calculator"
          className="scroll-mt-14 rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-graphite)] p-3 text-white sm:p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
                Estimate
              </h2>
              <div className="flex rounded border border-white/15 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setBillingMode("managed");
                    setSelectedChannel("email");
                  }}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    billingMode === "managed"
                      ? "bg-[var(--hm-accent)]/20 text-[var(--hm-accent)]"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  Managed
                </button>
                <button
                  type="button"
                  onClick={() => setBillingMode("byo")}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    billingMode === "byo"
                      ? "bg-[var(--hm-accent)]/20 text-[var(--hm-accent)]"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  Bring your own
                </button>
              </div>
            </div>
            <p className="font-mono text-[11px] text-white/40">{anchorHint}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <label htmlFor="spend-input" className="sr-only">
                Budget amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-white/40">
                  {currency === "NGN" ? "₦" : "$"}
                </span>
                <input
                  id="spend-input"
                  type="number"
                  min={currency === "NGN" ? 100 : 1}
                  step={currency === "NGN" ? 100 : 1}
                  value={spendInput}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (!Number.isFinite(raw) || raw < 0) {
                      setSpendInput(0);
                      return;
                    }
                    setSpendInput(currency === "NGN" ? Math.round(raw) : Math.round(raw));
                  }}
                  className="h-9 w-full rounded-[var(--radius)] border border-white/15 bg-black/30 py-1 pl-6 pr-2 font-mono text-sm text-white outline-none focus:border-[var(--hm-accent)]"
                />
              </div>
              <p className="font-mono text-[10px] text-white/35">
                {budgetLabel} → {formatTokens(tokens)} {unitLabel}
              </p>
            </div>

            <div className="flex flex-col justify-center rounded-[var(--radius)] border border-[var(--hm-accent)]/35 bg-black/25 px-3 py-3">
              {billingMode === "byo" ? (
                <>
                  <p className="text-[10px] text-white/45">BYO: you pay provider, we charge 1 token/event.</p>
                  <p className="mt-1 font-mono text-2xl font-bold leading-tight text-[var(--hm-accent)]">
                    {formatTokens(tokens)}
                    <span className="ml-1.5 text-sm font-normal text-white/40">events</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-white/45">{formatTokens(tokens)} tokens — by channel.</p>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {MANAGED_CHANNELS.map((id) => {
                      const logo = CHANNEL_LOGOS[id];
                      const active = selectedChannel === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedChannel(id)}
                          className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] ${
                            active
                              ? "border-[var(--hm-accent)] bg-[var(--hm-accent)]/15 text-white"
                              : "border-white/15 text-white/50 hover:text-white"
                          }`}
                        >
                          <img src={logo.src} alt="" className="size-3 object-contain" />
                          {CHANNEL_LABELS[id]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2.5 rounded-[var(--radius)] border border-[var(--hm-accent)]/25 bg-black/20 px-2.5 py-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-white p-1">
                      <img
                        src={selectedLogo.src}
                        alt={selectedLogo.alt}
                        className="size-4 object-contain"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-white/45">
                        If you spent all {formatTokens(tokens)} tokens on{" "}
                        {CHANNEL_LABELS[selectedChannel].toLowerCase()}
                      </p>
                      <p className="font-mono text-xl font-bold leading-tight text-[var(--hm-accent)]">
                        {formatTokens(selectedSends)}
                        <span className="ml-1 text-[11px] font-normal text-white/40">
                          {CHANNEL_UNIT_LABEL[selectedChannel]}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-white/40 sm:grid-cols-3">
                    {MANAGED_CHANNELS.filter((id) => id !== selectedChannel).map((id) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => setSelectedChannel(id)}
                          className="text-left hover:text-white/70"
                        >
                          {CHANNEL_LABELS[id]}: {formatTokens(sendsByChannel[id])}{" "}
                          {CHANNEL_UNIT_LABEL[id]}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>

        {billingMode === "byo" && (
          <p className="mt-2 text-[11px] text-[var(--color-muted)]">
            Managed only (not BYO):{" "}
            {MANAGED_ONLY_CHANNELS.map((id) => CHANNEL_LABELS[id]).join(", ")} — billed at managed
            rates.
          </p>
        )}

        <section id="packs" className="mt-6 scroll-mt-14">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink)]">
            {billingMode === "byo" ? "Event packs" : "Token packs"}
          </h2>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            Click to buy · {currency}
            {billingMode === "byo"
              ? ` · $1 / ₦1,000 → ${formatTokens(1_250)} events`
              : ` · $1 / ₦1,000 → ${formatTokens(MANAGED_LIST_TOKENS)} tokens`}
          </p>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {packs.map((pkg) => {
              const price = packPrice(pkg, currency);
              const href = `/register?pack=${encodeURIComponent(pkg.id)}&currency=${currency}&mode=${billingMode}`;
              return (
                <Link
                  key={pkg.id}
                  href={href}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-2.5 py-2 transition-colors hover:border-[var(--hm-accent)]"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-[var(--color-ink)]">
                      {formatMoney(price, currency)}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--color-muted)]">
                      {formatTokens(pkg.tokens)} {billingMode === "byo" ? "events" : "tokens"}
                      {pkg.savingsPercent > 0 ? ` · −${pkg.savingsPercent}%` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-[var(--hm-accent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-accent-ink)]">
                    Buy
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-6 flex flex-col items-start justify-between gap-2 rounded-[var(--radius)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-3 sm:flex-row sm:items-center">
          <p className="text-xs text-[var(--color-ink)]">
            Start with {formatTokens(WELCOME_SIGNUP_TOKENS)} free tokens — no card required.
          </p>
          <Button
            asChild
            size="sm"
            className="h-7 px-2.5 text-xs bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90"
          >
            <Link href="/register">Create account</Link>
          </Button>
        </section>
      </main>

      <footer className="mt-6 border-t border-[var(--color-rule)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 text-[11px] text-[var(--color-muted)]">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[var(--color-ink)] hover:text-[var(--hm-accent)]"
          >
            <SanarwaMark className="size-3.5 text-[var(--hm-accent)]" />
            <span className="font-medium">Sanarwa</span>
          </Link>
          <p>© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
