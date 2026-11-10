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
      <div className={`${SHELL} py-16`}>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <p className="lp-statement max-w-[16ch] text-lp-ink">
            one request.
            <br />
            one receipt.
          </p>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-12 gap-y-3 text-[0.875rem] sm:flex sm:flex-wrap sm:gap-x-10"
          >
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-lp-ink-2 transition-colors hover:text-lp-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-lp-rule pt-6 text-[12px] text-lp-muted sm:flex-row sm:items-baseline sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <SanarwaWordmark
              showMark={false}
              labelClassName="font-lp-display text-[1.125rem] leading-none text-lp-ink"
            />
            <p>© {new Date().getFullYear()}</p>
          </div>
          <p>email, sms, whatsapp, push, in-app, voice</p>
        </div>
      </div>
    </footer>
  );
}
