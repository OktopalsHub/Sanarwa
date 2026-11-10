"use client";

import Link from "@/compat/next-link";
import {
  BYO_EVENT_TOKEN_COST,
  isByoEligibleChannel,
  MANAGED_CHANNEL_TOKEN_COST,
  type ChannelId,
} from "@/lib/pricing";
import { LINK, SHELL } from "./shared";

const ROWS: { channel: ChannelId; use: string; unit?: string }[] = [
  {
    channel: "email",
    use: "Receipts, digests and transactional mail.",
  },
  {
    channel: "sms",
    use: "OTPs, alerts and time-critical messages.",
  },
  {
    channel: "whatsapp",
    use: "Business-initiated messages from approved templates.",
  },
  {
    channel: "push",
    use: "Mobile and web notifications to registered devices.",
  },
  {
    channel: "in_app",
    use: "Feeds, banners and unread state in your product.",
  },
  {
    channel: "voice",
    use: "Text-to-speech calls when it must be heard.",
    unit: "tokens / min",
  },
];

const LABELS: Record<ChannelId, string> = {
  email: "email",
  sms: "sms",
  whatsapp: "whatsapp",
  push: "push",
  in_app: "in-app",
  voice: "voice",
};

export function ChannelRates() {
  return (
    <section className="border-y border-lp-rule bg-lp-paper-2">
      <div className={`${SHELL} py-[var(--lp-section)]`}>
        <div className="grid gap-6 md:grid-cols-12 md:items-end">
          <h2 className="lp-section-head text-lp-ink md:col-span-6">
            the token rate behind each channel.
          </h2>
          <p className="lp-lead max-w-[46ch] text-lp-ink-2 md:col-span-5 md:col-start-8">
            The request shape does not change between channels. The token rate does.
          </p>
        </div>

        <div className="mt-12">
          <table className="lp-ledger">
            <caption className="sr-only">
              Managed and bring-your-own token rates for each delivery channel
            </caption>
            <thead>
              <tr>
                <th scope="col">channel</th>
                <th scope="col">best for</th>
                <th scope="col" className="text-right">
                  managed
                </th>
                <th scope="col" className="text-right">
                  bring your own
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.channel}>
                  <th scope="row">
                    <span className="lp-title text-lp-ink">{LABELS[row.channel]}</span>
                  </th>
                  <td
                    className="text-[0.9375rem] leading-relaxed text-lp-ink-2"
                    data-label="Best for"
                  >
                    {row.use}
                  </td>
                  <td className="whitespace-nowrap" data-label="Managed">
                    <span className="font-lp-mono text-[1rem] text-lp-ink">
                      {MANAGED_CHANNEL_TOKEN_COST[row.channel]}
                    </span>
                    {row.unit ? (
                      <span className="lp-readout ml-2 text-lp-muted">{row.unit}</span>
                    ) : null}
                  </td>
                  <td
                    className="whitespace-nowrap font-lp-mono text-[0.8125rem] text-lp-ink-2"
                    data-label="Bring your own"
                  >
                    {isByoEligibleChannel(row.channel)
                      ? `${BYO_EVENT_TOKEN_COST} token / event`
                      : "managed only"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <Link href="/pricing" className={LINK}>
            see token pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
