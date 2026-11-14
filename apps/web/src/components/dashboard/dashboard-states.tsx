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
import { IconArrowRight, IconCheck, IconInbox } from "@tabler/icons-react";

interface SetupStep {
  done: boolean;
  href: string;
  label: string;
  detail: string;
}

export function MilestoneChecklist({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length;

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Get started</h2>
          <p className="text-sm text-muted-foreground">Three steps to send your first message.</p>
        </div>
        <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {done} of {steps.length} done
        </p>
      </div>

      <ol>
        {steps.map((step, index) => (
          <li key={step.label} className="border-b last:border-b-0">
            <Link
              href={step.href}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                  step.done ? "bg-success text-white" : "border border-input text-muted-foreground",
                )}
              >
                {step.done ? <IconCheck className="size-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn("block text-sm font-medium", step.done && "text-muted-foreground")}
                >
                  {step.label}
                  <span className="sr-only">{step.done ? " — done" : " — not done yet"}</span>
                </span>
                <span className="block text-sm text-muted-foreground">{step.detail}</span>
              </span>
              {step.done ? null : (
                <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-foreground">
                  Start
                  <IconArrowRight className="size-4" aria-hidden />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function DashboardEmpty({ basePath }: { basePath: string }) {
  return (
    <Empty className="w-full border">
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
