import { Button } from "@sanarwa/ui/button";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";

export function SectionError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-dashed border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <IconAlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
        <span className="truncate">Couldn’t load {label}.</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onRetry} className="shrink-0">
        <IconRefresh aria-hidden />
        Retry
      </Button>
    </div>
  );
}
