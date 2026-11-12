"use client";

import Link from "@/compat/next-link";
import { SanarwaMark } from "@sanarwa/assets";
import type { Icon } from "@tabler/icons-react";

export function SplitPanel({
  eyebrow,
  headline,
  sub,
  sticker,
  chips,
  footnote,
  switchTo,
}: {
  eyebrow: string;
  headline: React.ReactNode;
  sub: string;
  sticker: React.ReactNode;
  chips: Array<{ icon: Icon; label: string }>;
  footnote: string;
  switchTo?: React.ReactNode;
}) {
  return (
    <aside className="relative hidden min-h-0 min-w-0 flex-col justify-between overflow-hidden border-r border-[var(--color-rule)] bg-[var(--color-graphite)] px-10 py-10 lg:flex xl:px-14">
      <div
        className="absolute -left-28 top-16 size-56 rounded-full border-2 border-[var(--color-rule-2)]"
        aria-hidden
      />
      <div
        className="absolute -right-28 -bottom-28 size-40 rotate-45 border-2 border-[#ed985f]/25"
        aria-hidden
      />

      <Link
        href="/"
        className="relative z-10 inline-flex min-h-11 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
        aria-label="Back to Sanarwa home"
      >
        <SanarwaMark className="size-8 text-[var(--hm-accent)]" />
        <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-[var(--tracking-display)] text-white">
          Sanarwa
        </span>
      </Link>

      <div className="relative z-10 max-w-md">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">
          {eyebrow}
        </p>
        <h1
          className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2.6rem,4.4vw,3.75rem)] font-bold leading-[0.98] tracking-[var(--tracking-display)] text-white [text-wrap:balance]"
          style={{ fontStyle: "normal" }}
        >
          {headline}
        </h1>
        <p className="mt-5 max-w-[38ch] text-[0.9375rem] leading-relaxed text-white/65">{sub}</p>

        <div className="mt-8">{sticker}</div>

        <div className="mt-7 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-white/70"
            >
              <chip.icon className="size-3.5" aria-hidden />
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
        <span>{footnote}</span>
        {switchTo ? <span>{switchTo}</span> : null}
      </div>
    </aside>
  );
}

export function StickerCard({
  label,
  primary,
  secondary,
  accent = false,
}: {
  label: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="inline-block max-w-[26rem] rounded-xl border border-white/15 bg-[var(--color-paper-2)] px-4 py-3 shadow-[6px_6px_0_rgba(0,0,0,0.45)]">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-[1.05rem] font-medium leading-snug ${
          accent ? "text-[var(--color-accent-ink)]" : "text-[var(--color-ink)]"
        }`}
      >
        {primary}
      </p>
      {secondary ? (
        <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-[var(--color-muted)]">
          {secondary}
        </p>
      ) : null}
    </div>
  );
}

export function AuthSplitShell({
  panel,
  children,
}: {
  panel: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-dvh overflow-hidden bg-[var(--color-paper)] text-[var(--color-ink-2)]">
      {panel}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-10 lg:px-12">
        <div className="mx-auto flex w-full max-w-[24rem] shrink-0 items-center justify-between py-2 lg:hidden">
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2"
            aria-label="Sanarwa home"
          >
            <SanarwaMark className="size-7 text-[var(--hm-accent)]" />
            <span className="font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-[var(--color-ink)]">
              Sanarwa
            </span>
          </Link>
        </div>
        <div className="mx-auto flex w-full min-w-0 max-w-[24rem] flex-1 flex-col justify-center py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
