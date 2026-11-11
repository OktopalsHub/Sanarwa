"use client";

import { Card } from "@sanarwa/ui/card";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  className?: string;
}

export function MetricCard({ title, value, icon: Icon, description, className }: MetricCardProps) {
  return (
    <Card
      className={cn(
        "border-border bg-card p-5 transition-colors hover:border-border/80 hover:bg-muted/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {description ? <p className="mt-2 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className="shrink-0 rounded-lg border border-border bg-muted/40 p-2.5">
          <Icon className="size-5 text-muted-foreground" aria-hidden />
        </div>
      </div>
    </Card>
  );
}
