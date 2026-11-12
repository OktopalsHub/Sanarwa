"use client";

import { Button } from "@sanarwa/ui/button";
import { Card } from "@sanarwa/ui/card";
import { Skeleton } from "@sanarwa/ui/skeleton";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { SectionError } from "./section-error";
import { IconCoin } from "@tabler/icons-react";
import Link from "@/compat/next-link";

export function TokenPeek({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data:
    | {
        balance: {
          totalTokens: number;
          usedTokens: number;
          availableTokens: number;
          reservedTokens?: number;
        };
        usage: { totalUsed: number };
      }
    | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const basePath = useTenantBasePath();

  return (
    <Card className="border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="text-sm font-semibold text-foreground">Tokens</h3>
        <Button asChild variant="ghost" size="sm">
          <Link href={`${basePath}/billing`}>Top up</Link>
        </Button>
      </div>
      <div className="p-6">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : isError || !data ? (
          <SectionError label="token balance" onRetry={onRetry} />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <IconCoin className="size-6 text-primary" aria-hidden />
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {data.balance.availableTokens.toLocaleString()}
              </p>
            </div>
            <dl className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex items-center justify-between tabular-nums">
                <dt>Used in the last 30 days</dt>
                <dd>{data.usage.totalUsed.toLocaleString()}</dd>
              </div>
              {data.balance.reservedTokens !== undefined && data.balance.reservedTokens > 0 ? (
                <div className="flex items-center justify-between tabular-nums">
                  <dt>Reserved</dt>
                  <dd>{data.balance.reservedTokens.toLocaleString()}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        )}
      </div>
    </Card>
  );
}
