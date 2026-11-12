"use client";

import Link from "@/compat/next-link";
import { formatTokens, WELCOME_SIGNUP_TOKENS } from "@/lib/pricing";
import { KEY, KEY_QUIET } from "./shared";
import { ReceiptConsole } from "./receipt-console";

const PROVIDERS = "SES · Twilio · Termii · Meta · FCM · Telnyx";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12rem] h-[28rem] w-[60rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(237,152,95,0.14),transparent)]"
      />
      <div className="lp-shell relative flex flex-col items-center pb-20 pt-16 text-center sm:pt-20">
        <span className="lp-chip">
          <span className="lp-chip__dot" aria-hidden />
          one payload · six channels · one receipt
        </span>

        <h1 className="lp-display mt-6 max-w-[16ch] text-[clamp(2.625rem,6vw,4.5rem)] font-semibold text-lp-ink">
          Send once,
          <br />
          <span className="text-lp-accent">reach six channels.</span>
        </h1>

        <p className="lp-lead mt-6 max-w-[52ch] text-lp-ink-2">
          One API for email, SMS, WhatsApp, push, voice and in-app — failover, delivery receipts and
          token billing, ready on day one.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className={KEY}>
            get api keys
          </Link>
          <Link href="/docs" className={KEY_QUIET}>
            read the docs
          </Link>
        </div>

        <p className="lp-readout mt-5 text-lp-muted">
          {formatTokens(WELCOME_SIGNUP_TOKENS)} welcome tokens · no credit card
        </p>

        <ReceiptConsole className="relative z-10 mt-12 w-full max-w-3xl" />

        <p className="lp-readout relative z-10 mt-6 text-lp-muted">{PROVIDERS}</p>
      </div>
    </section>
  );
}
