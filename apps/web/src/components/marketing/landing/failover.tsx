"use client";

import Link from "@/compat/next-link";
import { SHELL } from "./shared";

const ATTEMPTS = [
  { time: "14:02:11.204", event: "sms → twilio", result: "429 rate_limited", tone: "danger" },
  { time: "14:02:11.206", event: "retry scheduled", result: "backoff 1s", tone: "muted" },
  { time: "14:02:12.208", event: "sms → termii", result: "201 accepted", tone: "live" },
  { time: "14:02:12.640", event: "webhook emitted", result: "sms.delivered", tone: "ink" },
] as const;

const TONE = {
  danger: "text-lp-danger",
  muted: "text-lp-muted",
  live: "text-lp-ok",
  ink: "text-lp-ink",
} as const;

export function Failover() {
  return (
    <section className="border-t border-lp-rule">
      <div
        className={`${SHELL} grid gap-10 py-[clamp(3.5rem,7vw,6rem)] lg:grid-cols-12 lg:items-start`}
      >
        <div className="lg:col-span-5">
          <h2 className="lp-section-head mt-0 text-[clamp(1.75rem,3.2vw,2.75rem)] text-lp-ink">
            A 429 is not
            <br />a delivery failure.
          </h2>
          <p className="lp-lead mt-5 max-w-[44ch] text-lp-ink-2">
            When Twilio rate-limits, we reroute through Termii and log both attempts against one
            message id. Your code never retries. You read one receipt.
          </p>
          <p className="lp-readout mt-6 text-lp-muted">sample trace</p>
        </div>

        <div className="min-w-0 lg:col-span-7">
          <ol className="lp-panel overflow-hidden" aria-label="Example SMS failover trace">
            {ATTEMPTS.map((attempt) => (
              <li
                key={attempt.time}
                className="border-b border-lp-rule-soft px-6 py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="lp-readout text-lp-muted">{attempt.time}</p>
                  <p className={`font-lp-mono text-[12px] ${TONE[attempt.tone]}`}>
                    {attempt.result}
                  </p>
                </div>
                <p className="mt-1.5 font-lp-mono text-[0.8125rem] text-lp-ink">{attempt.event}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
