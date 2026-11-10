"use client";

import Link from "@/compat/next-link";
import { SanarwaWordmark } from "@sanarwa/assets";
import { KEY_SM, NAV_LINKS, SHELL } from "./shared";

export function SiteHeader() {
  return (
    <header className="sticky top-3 z-40">
      <div className={SHELL}>
        <div className="flex h-14 items-center gap-5 rounded-[var(--radius-lp-pill)] border border-lp-rule bg-lp-paper-2 px-4 shadow-[var(--shadow-lp-nav)] sm:px-5">
          <Link href="/" aria-label="Sanarwa home" className="shrink-0">
            <SanarwaWordmark
              markClassName="size-5 text-lp-accent"
              labelClassName="font-lp-display text-[1.25rem] leading-none text-lp-ink max-sm:hidden"
            />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[0.875rem] text-lp-ink-2 transition-colors hover:text-lp-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/login"
              className="text-[0.875rem] text-lp-ink-2 transition-colors hover:text-lp-ink"
            >
              sign in
            </Link>
            <Link href="/register" className={KEY_SM}>
              get api keys
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
