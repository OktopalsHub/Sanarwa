"use client";

import Link from "@/compat/next-link";
import { BYO_EVENT_TOKEN_COST } from "@/lib/pricing";
import { LINK, SHELL } from "./shared";
import { DispatchConsole } from "./dispatch-console";

const ATTEMPTS = [
  { time: "14:02:11.204", event: "sms → twilio", result: "429 rate_limited", tone: "danger" },
  { time: "14:02:11.206", event: "retry scheduled", result: "backoff 1s", tone: "muted" },
  { time: "14:02:12.208", event: "sms → termii", result: "201 accepted", tone: "live" },
  { time: "14:02:12.640", event: "webhook emitted", result: "sms.delivered", tone: "ink" },
] as const;

const TONE = {
  danger: "text-lp-danger",
  muted: "text-lp-muted",
  live: "text-lp-live",
  ink: "text-lp-ink",
} as const;

const PROVIDERS = [
  { channel: "email", names: "SES, Mailgun, SendGrid" },
  { channel: "sms", names: "Twilio, Termii" },
  { channel: "whatsapp", names: "Meta" },
  { channel: "push", names: "FCM" },
  { channel: "voice", names: "Telnyx" },
  { channel: "in-app", names: "Sanarwa" },
] as const;

export function Bento() {
  return (
    <section className={`${SHELL} pt-[clamp(2.5rem,4vw,3.25rem)] pb-[var(--lp-section)]`}>
      <div className="grid gap-6 md:grid-cols-12 md:items-end">
        <h2 className="lp-section-head text-lp-ink md:col-span-6">one send, six receipts.</h2>
        <p className="lp-lead max-w-[46ch] text-lp-ink-2 md:col-span-5 md:col-start-8">
          One message id, one status per channel, every attempt behind it.
        </p>
      </div>

      <div className="mt-12 grid gap-[var(--lp-bento-gap)] lg:grid-cols-12">
        <DispatchConsole className="lg:col-span-7 lg:row-span-2" />

        <article className="lp-well p-6 lg:col-span-5">
          <h3 className="lp-title text-lp-ink">a 429 is not a delivery failure.</h3>
          <ol className="lp-ruler mt-6" aria-label="Example SMS failover trace">
            {ATTEMPTS.map((attempt) => (
              <li key={attempt.time}>
                <span
                  aria-hidden
                  className={`lp-ruler-node ${
                    attempt.tone === "danger" ? "lp-ruler-node--alert" : ""
                  }`}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <p className="lp-readout text-lp-muted">{attempt.time}</p>
                  <p className={`font-lp-mono text-[12px] ${TONE[attempt.tone]}`}>
                    {attempt.result}
                  </p>
                </div>
                <p className="mt-1 font-lp-mono text-[0.8125rem] text-lp-ink">{attempt.event}</p>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t border-lp-rule pt-4 text-[12px] text-lp-muted">
            Sample trace.
          </p>
        </article>

        <article className="lp-well p-6 lg:col-span-5">
          <h3 className="lp-title text-lp-ink">managed, or your own.</h3>
          <dl className="mt-5">
            {PROVIDERS.map((row) => (
              <div
                key={row.channel}
                className="flex items-baseline justify-between gap-4 border-t border-lp-rule py-2.5 first:border-t-0 first:pt-0 last:pb-0"
              >
                <dt className="text-[0.9375rem] text-lp-ink">{row.channel}</dt>
                <dd className="text-right text-[0.875rem] text-lp-muted">{row.names}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-lp-rule pt-4 text-[12px] leading-relaxed text-lp-muted">
            Bring your own for {BYO_EVENT_TOKEN_COST} token per event. In-app is managed only.
          </p>
        </article>

        <article className="lp-well flex flex-wrap items-end justify-between gap-6 p-6 lg:col-span-12 lg:p-8">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <p className="lp-section-head text-lp-ink">250</p>
            <p className="lp-readout text-lp-muted">tokens / min</p>
          </div>
          <div className="max-w-[44ch]">
            <h3 className="lp-title text-lp-ink">when it must be heard.</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-lp-ink-2">
              Text-to-speech calls on Telnyx, for the messages an SMS cannot carry.
            </p>
          </div>
          <Link href="/pricing" className={LINK}>
            see token pricing
          </Link>
        </article>
      </div>
    </section>
  );
}
