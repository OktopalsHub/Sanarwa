"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Card } from "@sanarwa/ui/card";
import { Skeleton } from "@sanarwa/ui/skeleton";
import { statusVariant } from "@/lib/message-status";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { SectionError } from "./section-error";
import { IconArrowRight, IconInbox } from "@tabler/icons-react";
import Link from "@/compat/next-link";
import type { MessageLogListItem } from "@sanarwa/api-client";

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RecentDeliveries({
  records,
  isLoading,
  isError,
  onRetry,
}: {
  records: MessageLogListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const basePath = useTenantBasePath();

  return (
    <Card className="border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">Recent deliveries</h3>
        <Link
          href={`${basePath}/messages`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
          <IconArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
      <div className="px-3 py-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : isError ? (
          <div className="p-3">
            <SectionError label="recent deliveries" onRetry={onRetry} />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <IconInbox className="size-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">No messages in the last 30 days.</p>
          </div>
        ) : (
          <ul>
            {records.map((row) => (
              <li key={row.id}>
                <Link
                  href={`${basePath}/messages/${row.id}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
                >
                  <Badge variant="outline" className="capitalize">
                    {row.channel}
                  </Badge>
                  <span className="truncate text-sm font-medium text-foreground">{row.to}</span>
                  <Badge variant={statusVariant(row.status)} className="capitalize">
                    {row.status}
                  </Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatTime(row.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
