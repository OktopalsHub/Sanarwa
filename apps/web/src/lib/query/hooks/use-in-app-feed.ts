"use client";

import { apiClient } from "@/lib/api/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// World-class Novu-style feed hook - API feeding (poll) minimal for 1+1 @700M
// Polls every 30s, socket realtime can be added via InAppGateway /in-app later
export interface InAppFeedItem {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  seen: boolean;
  archived: boolean;
  feedId: string;
  createdAt: string;
  readAt?: string;
  seenAt?: string;
  data?: Record<string, any>;
}

export interface InAppFeedResponse {
  data: InAppFeedItem[];
  total: number;
  hasMore: boolean;
  unseenCount: number;
  unreadCount: number;
  page: number;
  limit: number;
}

export function useInAppFeed(tenantId?: string, subscriberId?: string, feedId = "default") {
  const enabled = !!tenantId && !!subscriberId;

  const feedQuery = useQuery({
    queryKey: ["in-app", "feed", tenantId, subscriberId, feedId],
    queryFn: async (): Promise<InAppFeedResponse> => {
      return apiClient.get<InAppFeedResponse>(`/tenants/${tenantId}/in-app/feed`, {
        subscriberId,
        feedId,
        limit: 20,
        page: 0,
      } as any);
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000, // API feeding fine for minimal 250 burst
    refetchOnWindowFocus: true,
  });

  const unseenQuery = useQuery({
    queryKey: ["in-app", "unseen-count", tenantId, subscriberId, feedId],
    queryFn: async (): Promise<{ count: number }> => {
      return apiClient.get<{ count: number }>(`/tenants/${tenantId}/in-app/unseen-count`, {
        subscriberId,
        feedId,
      } as any);
    },
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  return {
    feed: feedQuery.data,
    feedItems: feedQuery.data?.data || [],
    hasMore: feedQuery.data?.hasMore || false,
    total: feedQuery.data?.total || 0,
    unseenCount: unseenQuery.data?.count ?? feedQuery.data?.unseenCount ?? 0,
    unreadCount: feedQuery.data?.unreadCount ?? 0,
    isLoading: feedQuery.isLoading || unseenQuery.isLoading,
    isFetching: feedQuery.isFetching,
    refetch: () => {
      feedQuery.refetch();
      unseenQuery.refetch();
    },
  };
}

export function useInAppActions(tenantId?: string, subscriberId?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["in-app", "feed", tenantId, subscriberId] });
    queryClient.invalidateQueries({ queryKey: ["in-app", "unseen-count", tenantId, subscriberId] });
  };

  const markSeen = useMutation({
    mutationFn: async (ids?: string[]) => {
      return apiClient.patch(`/tenants/${tenantId}/in-app/seen`, { subscriberId, messageIds: ids });
    },
    onSuccess: invalidate,
  });

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiClient.patch(`/tenants/${tenantId}/in-app/read`, { subscriberId, messageIds: ids });
    },
    onSuccess: invalidate,
  });

  const markAllSeen = useMutation({
    mutationFn: async () => {
      return apiClient.post(`/tenants/${tenantId}/in-app/mark-all-seen`, { subscriberId });
    },
    onSuccess: invalidate,
  });

  const markArchived = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiClient.patch(`/tenants/${tenantId}/in-app/archived`, { subscriberId, messageIds: ids, archived: true });
    },
    onSuccess: invalidate,
  });

  return { markSeen, markRead, markAllSeen, markArchived };
}
