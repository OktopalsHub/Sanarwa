"use client";

import Link from "@/compat/next-link";
import { LINK, SHELL } from "./shared";

export function StageKey() {
  return (
    <section className="border-t border-lp-rule">
      <div className={`${SHELL} grid gap-10 py-[var(--lp-section)] lg:grid-cols-12 lg:items-start`}>
        <div className="lg:col-span-4">
          <h2 className="lp-section-head text-lp-ink">1.0 make a key.</h2>
          <p className="lp-lead mt-5 max-w-[34ch] text-lp-ink-2">
            Create a project. Its key is scoped to one tenant and one project.
          </p>
          <Link href="/register" className={`${LINK} mt-6`}>
            create an account
          </Link>
        </div>

        <div className="min-w-0 lg:col-span-8">
          <div className="lp-well overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 border-b border-lp-rule px-5 py-3.5">
              <p className="text-[0.8125rem] text-lp-muted">project key</p>
              <p className="lp-readout text-lp-muted">sample</p>
            </div>

            <div className="lp-blueprint p-5 sm:p-6">
              <p className="lp-readout text-lp-muted">SANARWA_API_KEY</p>
              <p className="mt-2 whitespace-nowrap font-lp-mono text-[0.9375rem] leading-relaxed text-lp-ink">
                ••••••••••••••••••••••••
              </p>

              <dl className="mt-5 grid gap-4 border-t border-lp-rule pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] text-lp-muted">header</dt>
                  <dd className="lp-readout mt-1 text-lp-ink">X-API-Key</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-lp-muted">scope</dt>
                  <dd className="lp-readout mt-1 text-lp-ink">tenant / project</dd>
                </div>
              </dl>
            </div>

            <p className="border-t border-lp-rule px-5 py-3.5 text-[12px] text-lp-muted">
              Keep it in the server environment, never in a client bundle.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
