"use client";

import {
  providerApi,
  type CreateProviderConfigRequest,
  type ProviderSchema,
  type ProviderTemplate,
} from "@sanarwa/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CatalogEntry {
  providerId: string;
  name: string;
  channel: string;
  isPopular: boolean;
  schema?: ProviderSchema;
}

const SELLABLE_CHANNELS = new Set(["email", "sms", "push"]);

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function buildCatalog(
  templates: ProviderTemplate[],
  schemas: ProviderSchema[],
): CatalogEntry[] {
  const entries = new Map<string, CatalogEntry>();
  const keyOf = (channel: string, providerId: string) => `${channel}:${providerId}`;

  for (const template of templates) {
    entries.set(keyOf(template.channel, template.providerId), {
      providerId: template.providerId,
      name: template.name,
      channel: template.channel,
      isPopular: Boolean(template.isPopular),
    });
  }

  for (const schema of schemas) {
    const key = keyOf(schema.channel, schema.providerId);
    const existing = entries.get(key);
    entries.set(key, {
      providerId: schema.providerId,
      name: existing?.name ?? titleCase(schema.providerId),
      channel: schema.channel,
      isPopular: existing?.isPopular ?? false,
      schema,
    });
  }

  return [...entries.values()]
    .filter((entry) => SELLABLE_CHANNELS.has(entry.channel))
    .sort((a, b) => Number(b.isPopular) - Number(a.isPopular) || a.name.localeCompare(b.name));
}

export function useProviderConfigs(projectId?: string) {
  return useQuery({
    queryKey: ["provider-configs", projectId],
    queryFn: () => providerApi.listProviders(projectId!, { limit: 100 }),
    enabled: Boolean(projectId),
  });
}

export function useProviderCatalog(projectId?: string) {
  return useQuery({
    queryKey: ["provider-catalog", projectId],
    queryFn: async () => {
      const [templates, schemas] = await Promise.all([
        providerApi.getTemplates(projectId!),
        providerApi.getSchemas(projectId!),
      ]);
      return buildCatalog(templates, schemas);
    },
    enabled: Boolean(projectId),
    staleTime: 5 * 60_000,
  });
}

export function useCreateProviderConfig(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProviderConfigRequest) => providerApi.createProvider(projectId!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-configs", projectId] }),
  });
}

export function useSetProviderActive(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active
        ? providerApi.activateProvider(projectId!, id)
        : providerApi.deactivateProvider(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-configs", projectId] }),
  });
}

export function useDeleteProviderConfig(projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => providerApi.deleteProvider(projectId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["provider-configs", projectId] }),
  });
}
