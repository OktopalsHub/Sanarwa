import { cn } from "@/lib/utils";
import { IconBolt } from "@tabler/icons-react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground",
        className,
      )}
    >
      <IconBolt className="size-4" aria-hidden />
    </span>
  );
}
