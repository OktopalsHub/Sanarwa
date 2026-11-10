const RECEIPTS = [
  { channel: "email", to: "amaka@halo.ng", note: null },
  { channel: "sms", to: "+234 801 ••• 5678", note: "429 rate_limited, retried on termii" },
  { channel: "whatsapp", to: "+234 801 ••• 5678", note: null },
  { channel: "push", to: "device token", note: null },
  { channel: "in-app", to: "user_812", note: null },
  { channel: "voice", to: "+234 801 ••• 5678", note: null },
] as const;

export function DispatchConsole({ className = "" }: { className?: string }) {
  return (
    <article
      className={`lp-well flex flex-col overflow-hidden ${className}`}
      aria-label="Sample dispatch receipt"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-lp-rule px-5 py-3.5">
        <p className="text-[0.8125rem] text-lp-muted">sample dispatch</p>
        <p className="lp-readout text-lp-live">201 created</p>
      </div>

      <ul className="flex flex-1 flex-col">
        {RECEIPTS.map((receipt) => (
          <li
            key={receipt.channel}
            className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-lp-rule px-5 py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="text-[0.9375rem] leading-snug text-lp-ink">{receipt.channel}</p>
              <p className="mt-0.5 truncate font-lp-mono text-[12px] text-lp-muted">{receipt.to}</p>
              {receipt.note ? (
                <p className="mt-1 font-lp-mono text-[11px] text-lp-danger">{receipt.note}</p>
              ) : null}
            </div>
            <p className="lp-readout text-lp-ink">delivered</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-lp-rule px-5 py-3">
        <p className="lp-readout text-lp-muted">msg_7f3c91a0</p>
      </div>
    </article>
  );
}
