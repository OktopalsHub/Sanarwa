import { Button } from "@sanarwa/ui/button";
import { Card } from "@sanarwa/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@sanarwa/ui/empty";
import { cn } from "@/lib/utils";
import { SendSnippet } from "@/components/messages/send-snippet";
import Link from "@/compat/next-link";
import { IconCheck, IconChevronDown, IconInbox } from "@tabler/icons-react";

interface SetupStep {
  done: boolean;
  href: string;
  label: string;
  detail: string;
}

export function MilestoneChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length;

  return (
    <details className="group overflow-hidden rounded-2xl border border-border bg-card" open>
      <summary
        className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)] sm:px-6"
        aria-label={`Get your workspace live — ${done} of ${steps.length} milestones complete`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-semibold text-foreground">Get your first message out</span>
          <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground tabular-nums">
            {done}/{steps.length} complete
          </span>
        </span>
        <IconChevronDown
          className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <ol className="flex flex-col border-t border-border">
        {steps.map((step, index) => (
          <li key={step.label} className="border-b border-border last:border-b-0">
            <Link
              href={step.href}
              className="flex min-h-14 items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus)] sm:px-6"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-semibold tabular-nums",
                  step.done
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground",
                )}
              >
                {step.done ? <IconCheck className="size-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {step.label}
                  <span className="sr-only">{step.done ? " — done" : " — not done yet"}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{step.detail}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {step.done ? "done" : "set up"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function DashboardEmpty({ basePath }: { basePath: string }) {
  return (
    <Empty className="border w-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconInbox />
        </EmptyMedia>
        <EmptyTitle>No messages yet</EmptyTitle>
        <EmptyDescription>
          Send from your app. Delivery events show up in Messages.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl">
        <SendSnippet />
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline">
            <Link href={`${basePath}/messages`}>Open messages</Link>
          </Button>
          <Button asChild>
            <Link href={`${basePath}/providers`}>Add a provider</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
