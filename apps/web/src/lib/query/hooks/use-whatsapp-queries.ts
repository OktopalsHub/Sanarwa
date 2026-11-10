"use client";

import { apiClient } from "@sanarwa/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useWABAStatus() {
  return useQuery({
    queryKey: ["whatsapp", "waba-status"],
    queryFn: async () => {
      return apiClient.get("/whatsapp/embedded-signup/status") as any;
    },
    staleTime: 30_000,
  });
}

export function useTemplateCapacity() {
  return useQuery({
    queryKey: ["whatsapp", "template-capacity"],
    queryFn: async () => {
      return apiClient.get("/whatsapp/embedded-signup/template-capacity") as any;
    },
    staleTime: 30_000,
  });
}

export function useInitiateEmbeddedSignup() {
  return useMutation({
    mutationFn: async (data: {
      businessName: string;
      businessEmail: string;
      businessPhone: string;
      businessWebsite?: string;
      redirectUri: string;
    }) => {
      return apiClient.post("/whatsapp/embedded-signup/initiate", data) as any;
    },
  });
}

export function useCompleteEmbeddedSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      code: string;
      state: string;
      wabaId?: string;
      phoneNumberId?: string;
    }) => {
      return apiClient.post("/whatsapp/embedded-signup/complete", data) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

export function useSyncWABA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiClient.post("/whatsapp/embedded-signup/sync", {}) as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp", "waba-status"] });
    },
  });
}

export function useDisconnectWABA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiClient.delete("/whatsapp/embedded-signup") as any;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp"] });
      qc.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}
