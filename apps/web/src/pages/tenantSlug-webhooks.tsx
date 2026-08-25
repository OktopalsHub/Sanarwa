"use client";

import { AppShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { webhookApi, type WebhookRecord } from "@/lib/api/webhook";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { toast } from "sonner";

const EVENT_OPTIONS = [
  "email.sent",
  "email.delivered",
  "email.bounced",
  "sms.sent",
  "sms.delivered",
  "whatsapp.sent",
  "push.sent",
  "notification.bulk_completed",
];

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [events, setEvents] = useState<string[]>(["email.delivered", "email.bounced"]);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => webhookApi.list(),
  });
  const webhooks = Array.isArray(data) ? data : [];

  const createMutation = useMutation({
    mutationFn: () => webhookApi.create({ name, url, secret: secret || undefined, events }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setUrl("");
      setName("");
      setSecret("");
      toast.success("Webhook created");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to create webhook"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      webhookApi.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhookApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted");
    },
  });

  const toggleEvent = (event: string, checked: boolean) => {
    setEvents((current) =>
      checked ? [...current, event] : current.filter((item) => item !== event),
    );
  };

  return (
    <AppShell>
      <div className="p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              Receive delivery events on your server as they happen.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Add endpoint</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="webhook-name">Name</Label>
                  <Input
                    id="webhook-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Production deliveries"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL</Label>
                  <Input
                    id="webhook-url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://api.yourapp.com/webhooks/sanarwa"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Secret (optional)</Label>
                <Input
                  id="webhook-secret"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="whsec_…"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {EVENT_OPTIONS.map((event) => (
                  <Button
                    key={event}
                    type="button"
                    size="sm"
                    variant={events.includes(event) ? "default" : "outline"}
                    onClick={() => toggleEvent(event, !events.includes(event))}
                  >
                    {event}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!url || events.length === 0 || createMutation.isPending}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Create webhook
              </Button>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="h-32 animate-pulse rounded-md border bg-muted/40" />
          ) : webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          ) : (
            <div className="space-y-3">
              {webhooks.map((webhook: WebhookRecord) => (
                <Card key={webhook.id}>
                  <CardContent className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium">{webhook.name || webhook.url}</p>
                      <p className="truncate text-sm text-muted-foreground">{webhook.url}</p>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={webhook.active}
                        onCheckedChange={(active) =>
                          toggleMutation.mutate({ id: webhook.id, active })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(webhook.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
