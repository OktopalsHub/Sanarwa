"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { messagingApi } from "@/lib/api/messaging";
import { useQuery } from "@tanstack/react-query";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "@/compat/next-link";

function formatTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function MessageDetail({ messageId }: { messageId: string }) {
  const basePath = useTenantBasePath();
  const { data, isLoading, error } = useQuery({
    queryKey: ["message", messageId],
    queryFn: () => messagingApi.get(messageId),
    enabled: Boolean(messageId),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`${basePath}/messages`}>
            <IconArrowLeft data-icon="inline-start" />
            Back to messages
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Message not found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`${basePath}/messages`}>
          <IconArrowLeft data-icon="inline-start" />
          Back to messages
        </Link>
      </Button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{data.to}</h1>
        <Badge variant="outline">{data.channel}</Badge>
        <Badge>{data.status}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Tracking ID</span> · {data.trackingId}
            </p>
            <p>
              <span className="text-muted-foreground">Subject</span> · {data.subject || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Created</span> · {formatTime(data.createdAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Sent</span> · {formatTime(data.sentAt)}
            </p>
            <p>
              <span className="text-muted-foreground">Delivered</span> ·{" "}
              {formatTime(data.deliveredAt)}
            </p>
            {data.error ? <p className="text-destructive">{data.error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.events?.length ? (
              data.events.map((event, index) => (
                <div
                  key={`${event.type}-${index}`}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <div>
                    <p className="font-medium capitalize">{event.type}</p>
                    {event.error ? <p className="text-destructive">{event.error}</p> : null}
                  </div>
                  <span className="text-muted-foreground">{formatTime(event.at)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No events recorded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {data.hasContent && data.content ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Metadata only — message body was not stored for this send.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
