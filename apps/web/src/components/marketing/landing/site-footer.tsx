"use client";

import Link from "@/compat/next-link";
import { SanarwaWordmark } from "@sanarwa/assets";
import { SHELL } from "./shared";

const FOOTER_LINKS = [
  { label: "docs", href: "/docs" },
  { label: "pricing", href: "/pricing" },
  { label: "sign in", href: "/login" },
  { label: "create account", href: "/register" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-lp-rule">
      <div className={`${SHELL} py-12 sm:py-16`}>
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <SanarwaWordmark
            markClassName="size-6 text-lp-ink"
            labelClassName="font-lp-display text-[1.0625rem] font-semibold tracking-[-0.02em] text-lp-ink"
          />

          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[0.875rem]"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-lp-muted transition-colors duration-150 hover:text-lp-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-lp-rule pt-6 text-[12px] text-lp-muted sm:flex-row sm:items-baseline sm:justify-between">
          <p>© {new Date().getFullYear()} Sanarwa</p>
          <p className="lp-readout">email · sms · whatsapp · push · in-app · voice</p>
        </div>
      </div>
    </footer>
  );
}
