"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  icon: ComponentType<{ className?: string }>;
  description?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  description,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "border-border bg-card p-5 transition-colors hover:border-border/80 hover:bg-muted/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
          {change ? (
            <span
              className={cn(
                "mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                change.type === "increase"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-700 dark:text-red-400",
              )}
            >
              {change.type === "increase" ? "↑" : "↓"} {Math.abs(change.value)}%
            </span>
          ) : null}
          {description ? (
            <p className="mt-2 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-2.5">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </div>
      </div>
    </Card>
  );
}
