"use client";

const RECEIPTS = [
  { channel: "email", to: "amaka@halo.ng", note: null, ok: true },
  { channel: "sms", to: "+234 801 ••• 5678", note: "twilio 429 → termii · 201", ok: true },
  { channel: "whatsapp", to: "+234 801 ••• 5678", note: null, ok: true },
  { channel: "push", to: "ExponentPushToken[…]", note: null, ok: true },
  { channel: "voice", to: "+234 801 ••• 5678", note: "telnyx · 60s", ok: true },
  { channel: "in-app", to: "user_812", note: null, ok: true },
] as const;

export function ReceiptConsole({ className = "" }: { className?: string }) {
  return (
    <figure
      className={`lp-panel-raised overflow-hidden text-left ${className}`}
      aria-label="Sample delivery receipt for one message sent to six channels"
    >
      <div className="flex items-center justify-between gap-4 border-b border-lp-rule px-5 py-3">
        <div className="flex items-center gap-2" aria-hidden>
          <span className="size-2.5 rounded-full bg-lp-field" />
          <span className="size-2.5 rounded-full bg-lp-field" />
          <span className="size-2.5 rounded-full bg-lp-field" />
        </div>
        <p className="lp-readout text-lp-muted">POST /api/v1/messaging/send</p>
        <p className="lp-readout text-lp-ink-2">201</p>
      </div>

      <ul className="flex flex-col">
        {RECEIPTS.map((receipt) => (
          <li
            key={receipt.channel}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-lp-rule-soft px-5 py-2.5 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="lp-readout text-lp-ink">{receipt.channel}</span>
                <span className="truncate font-lp-mono text-[11px] text-lp-muted">
                  {receipt.to}
                </span>
              </div>
              {receipt.note ? (
                <p className="mt-1 font-lp-mono text-[10.5px] text-lp-accent">{receipt.note}</p>
              ) : null}
            </div>
            <span className="lp-readout flex items-center gap-2 text-lp-ink-2">
              <span className="text-lp-ok" aria-hidden>
                ✓
              </span>
              delivered
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-lp-rule bg-lp-panel px-5 py-3">
        <p className="lp-readout text-lp-muted">msg_7f3c91a0</p>
        <p className="lp-readout text-lp-muted">6/6 delivered · 14:02:12Z</p>
      </div>
    </figure>
  );
}
