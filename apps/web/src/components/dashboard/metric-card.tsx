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
        "p-6 transition-all duration-300 hover:shadow-theme-md hover:scale-[1.02] glass border-border/50",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {change && (
              <span
                className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-colors",
                  change.type === "increase"
                    ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
                    : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30",
                )}
              >
                <span className="text-[10px]">{change.type === "increase" ? "↑" : "↓"}</span>
                {Math.abs(change.value)}%
              </span>
            )}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-2">{description}</p>}
        </div>
        <div className="ml-4 p-3 rounded-xl bg-primary/10 dark:bg-primary/20">
          <Icon className="size-6 text-primary" />
        </div>
      </div>
    </Card>
  );
}
