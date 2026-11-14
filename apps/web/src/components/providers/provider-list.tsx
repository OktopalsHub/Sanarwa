"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card } from "@sanarwa/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sanarwa/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sanarwa/ui/dropdown-menu";
import { Skeleton } from "@sanarwa/ui/skeleton";
import type { ProviderConfigRecord } from "@sanarwa/api-client";
import { IconDots, IconStar } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDeleteProviderConfig,
  useProviderConfigs,
  useSetProviderActive,
} from "@/lib/query/hooks/use-provider-configs";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  chat: "Chat",
  whatsapp: "WhatsApp",
  voice: "Voice",
};

export function ProviderList({ projectId }: { projectId: string }) {
  const { data, isLoading, isError } = useProviderConfigs(projectId);
  const setActive = useSetProviderActive(projectId);
  const remove = useDeleteProviderConfig(projectId);
  const [pendingDelete, setPendingDelete] = useState<ProviderConfigRecord | null>(null);

  const providers = (data?.data ?? []).filter((provider) =>
    ["email", "sms", "push"].includes(provider.channel),
  );

  const toggle = (provider: ProviderConfigRecord) =>
    setActive.mutate(
      { id: provider.id, active: !provider.isActive },
      {
        onSuccess: () =>
          toast.success(`${provider.providerName} ${provider.isActive ? "paused" : "resumed"}`),
        onError: () => toast.error(`Could not update ${provider.providerName}`),
      },
    );

  const confirmDelete = () => {
    if (!pendingDelete) return;
    remove.mutate(pendingDelete.id, {
      onSuccess: () => toast.success(`${pendingDelete.providerName} removed`),
      onError: () => toast.error(`Could not remove ${pendingDelete.providerName}`),
      onSettled: () => setPendingDelete(null),
    });
  };

  if (isLoading) {
    return (
      <Card className="gap-0 p-0">
        {[0, 1, 2].map((row) => (
          <div key={row} className="border-b px-5 py-4 last:border-b-0">
            <Skeleton className="h-5 w-48" />
          </div>
        ))}
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Couldn&apos;t load your providers. Refresh the page to try again.
      </Card>
    );
  }

  if (providers.length === 0) {
    return (
      <Card className="items-center gap-1 p-10 text-center">
        <p className="font-medium">No providers connected yet</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Connect an email, SMS or push provider with your own credentials. Sanarwa then sends
          through it, and falls back to the next one if it fails.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="gap-0 p-0">
        <ul>
          {providers.map((provider) => (
            <li
              key={provider.id}
              className="flex items-center justify-between gap-4 border-b px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{provider.providerName}</p>
                  {provider.isDefault ? (
                    <IconStar className="size-4 fill-current text-warning" aria-label="Default" />
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {CHANNEL_LABELS[provider.channel] ?? provider.channel} · priority{" "}
                  {provider.priority}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge variant={provider.isActive ? "default" : "secondary"}>
                  {provider.isActive ? "Active" : "Paused"}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${provider.providerName}`}
                    >
                      <IconDots className="size-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggle(provider)}>
                      {provider.isActive ? "Pause" : "Resume"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setPendingDelete(provider)}
                    >
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {pendingDelete?.providerName}?</DialogTitle>
            <DialogDescription>
              Messages will stop sending through it. You can connect it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
