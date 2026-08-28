import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SendSnippet } from "@/components/messages/send-snippet";
import Link from "@/compat/next-link";
import { IconInbox } from "@tabler/icons-react";

export function DashboardSetup({
  hasProvider,
  hasApiKey,
  basePath,
}: {
  hasProvider: boolean;
  hasApiKey: boolean;
  basePath: string;
}) {
  return (
    <Card className="border-dashed p-6">
      <h3 className="mb-4 text-lg font-semibold">Finish setup to send</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <SetupStep
          done={hasProvider}
          href={`${basePath}/providers`}
          label="Add a provider"
          detail="Email domain, SMS number, WhatsApp, or push."
        />
        <SetupStep
          done={hasApiKey}
          href={`${basePath}/api-keys`}
          label="Create an API key"
          detail="Authenticate POST /v1/messages from your app."
        />
      </div>
    </Card>
  );
}

function SetupStep({
  done,
  href,
  label,
  detail,
}: {
  done: boolean;
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start justify-between rounded-md border p-4 hover:bg-muted/40"
    >
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <span className="text-sm text-muted-foreground">{done ? "Done" : "Set up"}</span>
    </Link>
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
