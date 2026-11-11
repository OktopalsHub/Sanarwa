"use client";

import { useMemo, useState } from "react";
import { SanarwaMark } from "@sanarwa/assets";
import { SHELL } from "./shared";

const DEFAULT_SOURCE = `Subject: Receipt for {{amount}}

Hi {{customer_name}},

Your payment of {{amount}} is confirmed.
Order {{order_id}} is on its way.

Sanarwa`;

const DEFAULT_VARS: Record<string, string> = {
  customer_name: "Amaka",
  amount: "₦45,000",
  order_id: "ORD-2841",
};

type PreviewChannel = "email" | "sms" | "push";

const PREVIEW_TABS: { id: PreviewChannel; label: string }[] = [
  { id: "email", label: "email" },
  { id: "sms", label: "sms" },
  { id: "push", label: "push" },
];

function renderTemplate(source: string, vars: Record<string, string>): string {
  return source.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function extractTemplateVars(source: string): string[] {
  const keys = new Set<string>();
  for (const match of source.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    if (match[1]) keys.add(match[1]);
  }
  return [...keys];
}

function EmailPreview({ subject, lines }: { subject: string; lines: string[] }) {
  return (
    <div className="mx-auto w-full max-w-sm">
      <p className="lp-readout text-lp-muted">email</p>
      <p className="mt-2 text-[1.125rem] font-medium leading-snug text-lp-ink">{subject}</p>
      <div className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-lp-ink-2">
        {lines.map((line, index) => (
          <p key={`${index}-${line}`}>{line}</p>
        ))}
      </div>
      <span className="mt-5 inline-flex rounded-md bg-lp-accent px-3 py-1.5 text-[12px] font-medium text-lp-accent-ink">
        view order
      </span>
    </div>
  );
}

function SmsPreview({ body }: { body: string }) {
  const segments = body.length === 0 ? 0 : Math.ceil(body.length / 160);

  return (
    <div className="mx-auto w-full max-w-[22rem]">
      <div className="flex items-baseline justify-between lp-readout text-lp-muted">
        <span>sms</span>
        <span>now</span>
      </div>
      <p className="mt-3 border-y border-lp-rule py-3 text-[0.9375rem] leading-relaxed text-lp-ink">
        {body || "Your message will appear here."}
      </p>
      <p className="lp-readout mt-2 text-lp-muted">
        {body.length} characters, {segments} {segments === 1 ? "segment" : "segments"}
      </p>
    </div>
  );
}

function PushPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto flex w-full max-w-sm gap-3">
      <SanarwaMark className="size-8 shrink-0 text-lp-accent" />
      <div className="min-w-0">
        <p className="lp-readout text-lp-muted">Sanarwa, now</p>
        <p className="mt-1.5 text-[0.9375rem] font-medium text-lp-ink">{title}</p>
        <p className="mt-1 line-clamp-3 text-[0.9375rem] leading-relaxed text-lp-ink-2">
          {body || "Your message will appear here."}
        </p>
      </div>
    </div>
  );
}

export function TemplateDemo() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [vars, setVars] = useState(DEFAULT_VARS);
  const [preview, setPreview] = useState<PreviewChannel>("email");

  const varKeys = useMemo(() => extractTemplateVars(source), [source]);
  const rendered = renderTemplate(source, vars);
  const allLines = rendered.split("\n");
  const subject = allLines[0]?.replace(/^Subject:\s*/i, "") ?? "Preview";
  const bodyLines = allLines.slice(1).filter((line) => line.trim().length > 0);
  const smsBody = bodyLines.join(" ");
  const pushBody = bodyLines.slice(0, 2).join(" ");

  return (
    <section className="border-t border-lp-rule">
      <div className={`${SHELL} py-[clamp(3.5rem,7vw,6rem)]`}>
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <h2 className="lp-section-head text-[clamp(1.75rem,3.2vw,2.75rem)] text-lp-ink md:col-span-6">
            write it once,
            <br />
            render six.
          </h2>
          <p className="lp-lead max-w-[46ch] text-lp-muted md:col-span-5 md:col-start-8">
            One source and its variables, rendered for email, SMS and push. Edit the source — the
            preview recomputes.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="lp-panel flex min-w-0 flex-col">
            <div className="flex items-baseline justify-between gap-4 border-b border-lp-rule px-5 py-3.5">
              <label htmlFor="template-source" className="lp-readout text-lp-muted">
                template source
              </label>
              <p className="lp-readout text-lp-muted">payment-receipt</p>
            </div>
            <textarea
              id="template-source"
              name="template-source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              spellCheck={false}
              aria-label="Template source"
              className="mx-4 my-4 min-h-[13rem] flex-1 resize-y rounded-md border border-lp-rule bg-lp-ground p-4 font-lp-mono text-base leading-[1.7] text-lp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lp-focus sm:text-[13px]"
            />
            <div className="space-y-3 border-t border-lp-rule px-5 py-4">
              <p className="lp-readout text-lp-muted">variables</p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {varKeys.map((key) => (
                  <label key={key} className="flex flex-col gap-1.5">
                    <span className="font-lp-mono text-[11px] text-lp-muted">{key}</span>
                    <input
                      type="text"
                      name={key}
                      autoComplete="off"
                      value={vars[key] ?? ""}
                      onChange={(event) =>
                        setVars((previous) => ({ ...previous, [key]: event.target.value }))
                      }
                      placeholder={`{{${key}}}`}
                      className="h-11 rounded-md border border-lp-rule bg-lp-ground px-2.5 font-lp-mono text-base text-lp-ink outline-none transition-colors placeholder:text-lp-field focus-visible:border-lp-accent sm:text-[13px]"
                    />
                  </label>
                ))}
                {varKeys.length === 0 ? (
                  <p className="lp-readout text-lp-muted">Add a {"{{variable}}"} to the source.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lp-panel flex min-w-0 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lp-rule px-4 py-3">
              <p className="lp-readout text-lp-muted">rendering</p>
              <div
                className="flex items-center gap-1 rounded-md border border-lp-rule bg-lp-ground p-1"
                role="group"
                aria-label="Preview channel"
              >
                {PREVIEW_TABS.map((tab) => {
                  const active = preview === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setPreview(tab.id)}
                      className="min-h-9 rounded-md px-3 font-lp-mono text-[11px] text-lp-muted transition-colors duration-150 aria-pressed:bg-lp-panel-raised aria-pressed:text-lp-ink"
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex min-h-[21rem] flex-1 items-center p-6">
              {preview === "email" ? <EmailPreview subject={subject} lines={bodyLines} /> : null}
              {preview === "sms" ? <SmsPreview body={smsBody} /> : null}
              {preview === "push" ? <PushPreview title={subject} body={pushBody} /> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
