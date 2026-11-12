"use client";

import { Card } from "@sanarwa/ui/card";
import { Skeleton } from "@sanarwa/ui/skeleton";
import { SectionError } from "./section-error";

interface ChannelRow {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export function ChannelBreakdown({
  channels,
  isLoading,
  isError,
  onRetry,
}: {
  channels: ChannelRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const rows = channels ?? [];
  const maxSent = rows.reduce((max, row) => Math.max(max, row.sent), 0);

  return (
    <Card className="border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">By channel</h3>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex flex-col gap-3 p-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : isError ? (
          <SectionError label="channel analytics" onRetry={onRetry} />
        ) : rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            No channel activity in this period.
          </p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li key={row.channel} className="flex flex-col gap-1.5 px-2 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium capitalize text-foreground">
                    {row.channel.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {row.sent.toLocaleString()} sent · {row.deliveryRate.toFixed(1)}% delivered
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${row.channel}: ${row.sent.toLocaleString()} sent, ${row.deliveryRate.toFixed(1)}% delivered`}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${maxSent > 0 ? (row.sent / maxSent) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
