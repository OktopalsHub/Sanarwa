"use client";

import Link from "@/compat/next-link";
import { LINK, SHELL } from "./shared";

const STEPS = [
  {
    n: "01",
    title: "make a project key",
    body: "Create an account, add a project. Its key is scoped to that tenant and project — never usable elsewhere.",
  },
  {
    n: "02",
    title: "POST /api/v1/messaging/send",
    body: "Channels, recipients, payload. One request fans out per recipient's reachable channels.",
  },
  {
    n: "03",
    title: "read one receipt",
    body: "Every attempt logs against one message id — status per channel, reroutes included.",
  },
] as const;

export function Steps() {
  return (
    <section className="border-t border-lp-rule">
      <div className={`${SHELL} py-[clamp(3.5rem,7vw,6rem)]`}>
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <h2 className="lp-section-head text-[clamp(1.75rem,3.2vw,2.75rem)] text-lp-ink md:col-span-7">
            key, request, receipt.
          </h2>
          <p className="lp-readout text-lp-muted md:col-span-4 md:col-start-9 md:self-end">
            three steps · two minutes
          </p>
        </div>

        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-lp-rule bg-lp-rule md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="flex flex-col bg-lp-panel p-6 sm:p-7">
              <p className="lp-readout text-lp-muted">{step.n}</p>
              <h3 className="lp-title mt-3 text-[1.125rem] text-lp-ink">{step.title}</h3>
              <p className="mt-2 max-w-[40ch] text-[0.9375rem] leading-relaxed text-lp-ink-2">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Link href="/register" className={LINK}>
            create an account →
          </Link>
          <Link href="/docs" className={LINK}>
            read the quickstart →
          </Link>
        </div>
      </div>
    </section>
  );
}
