"use client";

import Link from "@/compat/next-link";
import { formatTokens, WELCOME_SIGNUP_TOKENS } from "@/lib/pricing";
import { KEY, KEY_QUIET, SHELL } from "./shared";

export function Hero() {
  return (
    <section className={`${SHELL} pt-[clamp(3.5rem,8vw,6.5rem)] pb-[clamp(2.5rem,4.5vw,3.75rem)]`}>
      <div className="max-w-[62rem]">
        <h1 className="lp-display text-lp-ink">
          <span className="block">send once,</span>
          <span className="block">
            <span className="lp-verb">reach</span> six channels.
          </span>
        </h1>

        <p className="lp-lead mt-6 max-w-[46ch] text-lp-ink-2">
          One API for six channels, with failover and a receipt.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/register" className={KEY}>
            get api keys
          </Link>
          <Link href="/docs" className={KEY_QUIET}>
            read the docs
          </Link>
        </div>

        <p className="mt-5 text-[0.875rem] text-lp-muted">
          Start with {formatTokens(WELCOME_SIGNUP_TOKENS)} tokens.
        </p>
      </div>
    </section>
  );
}
