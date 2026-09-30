"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { messagingApi, type MessageLogListItem } from "@/lib/api/messaging";
import { projectApi } from "@/lib/api/project";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";
import { MessageFilters } from "./message-filters";
import { MessageEmpty, MessageTable } from "./message-table";

export function MessageList() {
  const router = useRouter();
  const basePath = useTenantBasePath();
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data: projectsData } = useQuery({
    queryKey: ["projects", "message-filter"],
    queryFn: () => projectApi.getProjects({ limit: 100 }),
  });
  const projects = projectsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["messages", { channel, status, projectId, q, page }],
    queryFn: () =>
      messagingApi.list({
        page,
        limit: 25,
        channel: channel === "all" ? undefined : channel,
        status: status === "all" ? undefined : status,
        projectId: projectId === "all" ? undefined : projectId,
        q: q || undefined,
      }),
  });

  const records: MessageLogListItem[] = data?.records ?? [];
  const resetPage = (setter: (value: string) => void) => (value: string) => {
    setPage(1);
    setter(value);
  };

  return (
    <div className="flex flex-col gap-4">
      <MessageFilters
        q={q}
        channel={channel}
        status={status}
        projectId={projectId}
        projects={projects}
        onSearch={resetPage(setQ)}
        onChannel={resetPage(setChannel)}
        onStatus={resetPage(setStatus)}
        onProject={resetPage(setProjectId)}
      />

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : records.length === 0 ? (
        <MessageEmpty basePath={basePath} />
      ) : (
        <>
          <MessageTable
            records={records}
            onOpen={(id) => router.push(`${basePath}/messages/${id}`)}
          />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data?.totalItems ?? 0} message{(data?.totalItems ?? 0) === 1 ? "" : "s"}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= (data?.pageCount ?? 1)}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
