"use client";

import Link from "@/compat/next-link";
import { SanarwaWordmark } from "@sanarwa/assets";
import { KEY_SM, NAV_LINKS, SHELL } from "./shared";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-lp-rule bg-lp-ground/85 backdrop-blur-md">
      <div className={`${SHELL} flex h-16 items-center gap-6`}>
        <Link href="/" aria-label="Sanarwa home" className="shrink-0">
          <SanarwaWordmark
            markClassName="size-6 text-lp-ink"
            labelClassName="font-lp-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-lp-ink"
          />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[0.875rem] text-lp-muted transition-colors duration-150 hover:text-lp-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="hidden text-[0.875rem] text-lp-muted transition-colors duration-150 hover:text-lp-ink sm:block"
          >
            sign in
          </Link>
          <Link href="/register" className={KEY_SM}>
            get api keys
          </Link>
        </div>
      </div>
    </header>
  );
}
