"use client";

import { Card } from "@sanarwa/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  className?: string;
}

export function MetricCard({ title, value, description, className }: MetricCardProps) {
  return (
    <Card className={cn("gap-1 p-5", className)}>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </Card>
  );
}
