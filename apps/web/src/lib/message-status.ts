export function statusVariant(status: string) {
  if (status === "delivered") return "default" as const;
  if (status === "failed") return "destructive" as const;
  if (status === "sent") return "secondary" as const;
  return "outline" as const;
}
