"use client";

import { useState } from "react";
import Link from "@/compat/next-link";
import { LINK, SHELL } from "./shared";

type SnippetId = "curl" | "typescript" | "response";

const SNIPPETS: Record<SnippetId, string> = {
  curl: `curl -X POST https://api.sanarwa.com/api/v1/messaging/send \\
  -H "X-API-Key: $SANARWA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channels": ["email", "sms", "push"],
    "recipients": [{
      "id": "user_812",
      "email": "amaka@halo.ng",
      "phone": "+2348012345678",
      "deviceToken": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
    }],
    "subject": "Payment received",
    "data": "Your ₦45,000 payment is confirmed. Order ORD-2841 is on its way.",
    "variables": { "amount": "₦45,000", "orderId": "ORD-2841" }
  }'`,
  typescript: `const response = await fetch(
  "https://api.sanarwa.com/api/v1/messaging/send",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.SANARWA_API_KEY!,
    },
    body: JSON.stringify({
      channels: ["email", "sms", "push"],
      recipients: [
        {
          id: "user_812",
          email: "amaka@halo.ng",
          phone: "+2348012345678",
          deviceToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
        },
      ],
      subject: "Payment received",
      data: "Your ₦45,000 payment is confirmed. Order ORD-2841 is on its way.",
      variables: { amount: "₦45,000", orderId: "ORD-2841" },
    }),
  },
);

const receipt = await response.json();`,
  response: `{
  "id": "msg_7f3c91a0",
  "status": "delivered",
  "channels": ["email", "sms", "push"],
  "recipientCount": 1,
  "deliveries": [
    { "channel": "email", "status": "delivered", "trackingId": "ntf_1a0c" },
    { "channel": "sms", "status": "delivered", "trackingId": "ntf_9b41" },
    { "channel": "push", "status": "delivered", "trackingId": "ntf_4d02" }
  ],
  "createdAt": "2026-10-30T14:02:12.640Z"
}`,
};

const TABS: { id: SnippetId; label: string }[] = [
  { id: "curl", label: "curl" },
  { id: "typescript", label: "typescript" },
  { id: "response", label: "response" },
];

function CodePanel() {
  const [tab, setTab] = useState<SnippetId>("curl");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SNIPPETS[tab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="lp-well min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-lp-rule px-2 py-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
              className="lp-tab shrink-0 font-lp-mono"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-lp-pill)] border border-lp-rule-2 px-3 text-[12px] text-lp-ink transition-colors hover:bg-lp-paper-3"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>

      <pre className="lp-scroll max-h-[25rem] overflow-auto p-5 font-lp-mono text-[13px] leading-[1.7] text-lp-ink">
        <code>{SNIPPETS[tab]}</code>
      </pre>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-lp-rule px-5 py-3 text-[12px] text-lp-muted">
        <span className="text-lp-live">
          <span className="font-lp-mono">201</span> created
        </span>
        <span>
          id <span className="font-lp-mono text-lp-ink">msg_7f3c91a0</span>
        </span>
        <span>
          <span className="font-lp-mono text-lp-ink">3/3</span> delivered
        </span>
        <span className="ml-auto">sample</span>
      </div>
    </div>
  );
}

export function Quickstart() {
  return (
    <section className="border-t border-lp-rule">
      <div className={`${SHELL} grid gap-10 py-[var(--lp-section)] lg:grid-cols-12 lg:items-start`}>
        <div className="lg:col-span-4 lg:col-start-9">
          <h2 className="lp-section-head text-lp-ink">3.0 send, then read the receipt.</h2>
          <p className="lp-lead mt-5 max-w-[34ch] text-lp-ink-2">
            Post the payload once. Keep the message id; every delivery event lands on your webhook.
          </p>
          <Link href="/docs" className={`${LINK} mt-6`}>
            read the delivery docs
          </Link>
        </div>

        <div className="min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-1">
          <CodePanel />
        </div>
      </div>
    </section>
  );
}
