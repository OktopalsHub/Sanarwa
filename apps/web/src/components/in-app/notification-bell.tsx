"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInAppActions, useInAppFeed } from "@/lib/query/hooks/use-in-app-feed";
import { useCurrentUser } from "@/lib/query/hooks/use-auth-queries";
import { BellIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useParams } from "@tanstack/react-router";

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const params = useParams({ strict: false }) as { tenantSlug?: string };
  const tenantSlug = params?.tenantSlug;
  // Resolve tenantId: for minimal, use slug as id fallback if no lookup - api expects tenantId but our new inbox uses tenantId from path
  // In real app, resolve via useUserTenants find by slug; keep minimal for now
  const { data: user } = useCurrentUser();
  const subscriberId = (user as any)?.id || (user as any)?.user?.id;
  // Try to get tenantId from slug via localStorage or fallback to slug
  const tenantId = typeof window !== "undefined" ? (localStorage.getItem(`tenantId:${tenantSlug}`) || tenantSlug) : tenantSlug;

  const [open, setOpen] = useState(false);
  const { feedItems, unseenCount, isLoading, refetch } = useInAppFeed(tenantId, subscriberId);
  const { markSeen, markRead, markAllSeen } = useInAppActions(tenantId, subscriberId);

  // Mark seen on open (eyeball = Novu seen)
  useEffect(() => {
    if (open && unseenCount > 0 && feedItems.length) {
      const unseenIds = feedItems.filter((n) => !n.seen).map((n) => n.id);
      if (unseenIds.length) markSeen.mutate(unseenIds);
    }
  }, [open, unseenCount, feedItems]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <BellIcon className="h-5 w-5" />
          {unseenCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
              {unseenCount > 99 ? "99+" : unseenCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => markAllSeen.mutate()} disabled={unseenCount === 0}>
              Mark all seen
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
        </div>
        <ScrollArea className="h-96">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : feedItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <div className="divide-y">
              {feedItems.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead.mutate([n.id])}
                  className={`flex w-full gap-3 p-3 text-left hover:bg-muted/50 ${!n.seen ? "bg-muted/30" : ""}`}
                >
                  <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!n.seen ? "bg-blue-500" : "bg-transparent"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)} • {n.type}</p>
                  </div>
                  {!n.seen && <span className="shrink-0 text-xs text-blue-500">new</span>}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2 text-center">
          <span className="text-xs text-muted-foreground">API feeding every 30s • real-time via /in-app gateway when connected</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
