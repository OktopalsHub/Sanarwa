import { DefaultOptions, QueryClient } from "@tanstack/react-query";

const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: "always",
  },
  mutations: {
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 1;
    },
  },
};

export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

export const queryKeys = {
  auth: {
    user: () => ["auth", "user"] as const,
    permissions: (tenantId?: string) => ["auth", "permissions", tenantId] as const,
  },

  tenants: {
    all: () => ["tenants"] as const,
    detail: (id: string) => ["tenants", id] as const,
    members: (id: string) => ["tenants", id, "members"] as const,
    settings: (id: string) => ["tenants", id, "settings"] as const,
    branding: (id: string) => ["tenants", id, "branding"] as const,
  },

  campaigns: {
    all: (tenantId: string, filters?: Record<string, any>) =>
      ["campaigns", tenantId, filters] as const,
    detail: (tenantId: string, id: string) => ["campaigns", tenantId, id] as const,
    analytics: (tenantId: string, id: string, dateRange?: string) =>
      ["campaigns", tenantId, id, "analytics", dateRange] as const,
  },

  workflows: {
    all: (tenantId: string, filters?: Record<string, any>) =>
      ["workflows", tenantId, filters] as const,
    detail: (tenantId: string, id: string) => ["workflows", tenantId, id] as const,
    analytics: (tenantId: string, id: string, dateRange?: string) =>
      ["workflows", tenantId, id, "analytics", dateRange] as const,
  },

  templates: {
    all: (tenantId: string, channel?: string) => ["templates", tenantId, channel] as const,
    detail: (tenantId: string, id: string) => ["templates", tenantId, id] as const,
  },

  analytics: {
    dashboard: (tenantId: string, dateRange?: string) =>
      ["analytics", "dashboard", tenantId, dateRange] as const,
    campaigns: (tenantId: string, dateRange?: string) =>
      ["analytics", "campaigns", tenantId, dateRange] as const,
    workflows: (tenantId: string, dateRange?: string) =>
      ["analytics", "workflows", tenantId, dateRange] as const,
  },
} as const;

export const invalidateQueries = {
  auth: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.user() }),

  tenant: (tenantId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.settings(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tenants.branding(tenantId) });
  },

  campaigns: (tenantId: string, campaignId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all(tenantId) });
    if (campaignId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(tenantId, campaignId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.analytics(tenantId, campaignId),
      });
    }
  },

  workflows: (tenantId: string, workflowId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all(tenantId) });
    if (workflowId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(tenantId, workflowId) });
      queryClient.invalidateQueries({
        queryKey: queryKeys.workflows.analytics(tenantId, workflowId),
      });
    }
  },

  templates: (tenantId: string, templateId?: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.templates.all(tenantId) });
    if (templateId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.templates.detail(tenantId, templateId) });
    }
  },

  analytics: (tenantId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.campaigns(tenantId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.analytics.workflows(tenantId) });
  },
};
