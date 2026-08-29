"use client";

import { AuthBackLink } from "@/components/auth/auth-back-link";
import Link from "@/compat/next-link";
import { SanarwaMark } from "@sanarwa/assets";

/* Hallmark · macrostructure: Split Panel · tone: utilitarian · page: onboarding */

const SETUP_STEPS = [
  "Name your workspace",
  "Pick a URL slug for /your-team/dashboard",
  "Connect a provider and send your first message",
] as const;

interface OnboardingPageLayoutProps {
  children: React.ReactNode;
}

export function OnboardingPageLayout({ children }: OnboardingPageLayoutProps) {
  return (
    <div className="min-h-dvh overflow-x-clip bg-[var(--color-paper)] text-[var(--color-ink-2)]">
      <div className="mx-auto grid min-h-dvh min-w-0 max-w-6xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,26rem)]">
        <aside className="relative hidden min-h-0 min-w-0 flex-col justify-between overflow-hidden bg-[var(--color-graphite)] px-10 py-10 text-white lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-12deg, transparent, transparent 11px, var(--color-rule-2) 11px, var(--color-rule-2) 12px)",
            }}
            aria-hidden
          />
          <Link
            href="/"
            className="relative z-10 inline-flex min-h-10 items-center gap-2.5 rounded-[var(--radius-input)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-graphite)]"
            aria-label="Back to Sanarwa home"
          >
            <SanarwaMark className="size-8 text-[var(--hm-accent)]" />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-[var(--tracking-display)]">
              Sanarwa
            </span>
          </Link>

          <div className="relative z-10 max-w-md space-y-5">
            <h1
              className="font-[family-name:var(--font-display)] text-[length:var(--text-3xl)] font-bold leading-[1.12] tracking-[var(--tracking-display)] text-white"
              style={{ fontStyle: "normal" }}
            >
              Set up your workspace
            </h1>
            <p className="text-sm leading-relaxed text-white/65">
              One workspace per team. Your URL becomes the home for campaigns, messages, and
              billing.
            </p>
            <ol className="space-y-2.5 border-t border-white/10 pt-5">
              {SETUP_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-snug text-white/80">
                  <span
                    className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/15 font-mono text-[10px] text-white/50"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <p className="relative z-10 font-mono text-[11px] text-white/40">
            Wrong account?{" "}
            <Link
              href="/login"
              className="text-[var(--hm-accent)] underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col px-6 py-6 sm:px-10 lg:px-12 lg:py-8">
          <div className="mb-4 flex shrink-0 items-center justify-between gap-4 lg:hidden">
            <AuthBackLink />
            <Link
              href="/login"
              className="shrink-0 text-xs text-[var(--color-muted)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
            >
              Sign in
            </Link>
          </div>

          <div className="mx-auto flex w-full min-w-0 max-w-[22rem] flex-1 flex-col justify-center py-6">
            <AuthBackLink className="mb-4 hidden shrink-0 lg:inline-flex" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
