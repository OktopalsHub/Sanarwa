"use client";

import Link from "@/compat/next-link";
import {
  BYO_EVENT_TOKEN_COST,
  formatTokens,
  MANAGED_CHANNEL_TOKEN_COST,
  WELCOME_SIGNUP_TOKENS,
} from "@/lib/pricing";
import { Bento } from "@/components/marketing/landing/bento";
import { ChannelRates } from "@/components/marketing/landing/channel-rates";
import { Hero } from "@/components/marketing/landing/hero";
import { Quickstart } from "@/components/marketing/landing/quickstart";
import { SiteFooter } from "@/components/marketing/landing/site-footer";
import { SiteHeader } from "@/components/marketing/landing/site-header";
import { StageKey } from "@/components/marketing/landing/stage-key";
import { TemplateDemo } from "@/components/marketing/landing/template-demo";
import { KEY, LINK, SHELL } from "@/components/marketing/landing/shared";

function FinalCta() {
  return (
    <section className={`${SHELL} py-[var(--lp-section)]`}>
      <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <h2 className="lp-section-head text-lp-ink">
            Start with {formatTokens(WELCOME_SIGNUP_TOKENS)} tokens.
          </h2>
          <p className="lp-lead mt-5 max-w-[44ch] text-lp-ink-2">
            Create an account, copy a project key, send your first message.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 lg:col-span-4 lg:justify-self-end">
          <Link href="/register" className={KEY}>
            get api keys
          </Link>
          <Link href="/pricing" className={LINK}>
            see token pricing
          </Link>
        </div>
      </div>

      <dl className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius-lp-card)] border border-lp-rule bg-lp-rule sm:grid-cols-3">
        <div className="bg-lp-paper-2 px-5 py-6">
          <dt className="text-[0.8125rem] text-lp-muted">welcome credit</dt>
          <dd className="mt-2 text-lp-ink">
            <span className="font-lp-mono">{formatTokens(WELCOME_SIGNUP_TOKENS)}</span> tokens
          </dd>
        </div>
        <div className="bg-lp-paper-2 px-5 py-6">
          <dt className="text-[0.8125rem] text-lp-muted">managed email</dt>
          <dd className="mt-2 text-lp-ink">
            <span className="font-lp-mono">{MANAGED_CHANNEL_TOKEN_COST.email}</span> token per send
          </dd>
        </div>
        <div className="bg-lp-paper-2 px-5 py-6">
          <dt className="text-[0.8125rem] text-lp-muted">your own providers</dt>
          <dd className="mt-2 text-lp-ink">
            <span className="font-lp-mono">{BYO_EVENT_TOKEN_COST}</span> token per event
          </dd>
        </div>
      </dl>

      <p className="mt-6 text-[0.8125rem] text-lp-muted">
        Welcome tokens are credited to new accounts and spent per send.
      </p>
    </section>
  );
}

export default function Home() {
  return (
    <div className="landing min-h-screen bg-lp-paper text-lp-ink-2">
      <SiteHeader />
      <main>
        <Hero />
        <Bento />
        <StageKey />
        <TemplateDemo />
        <Quickstart />
        <ChannelRates />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
