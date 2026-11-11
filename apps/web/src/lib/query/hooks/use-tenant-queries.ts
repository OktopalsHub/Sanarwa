import { apiClient } from "@sanarwa/api-client";
import type {
  CreateTenantRequest,
  Tenant,
  TenantMember,
  UpdateTenantRequest,
} from "@/lib/types/tenant";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateQueries, queryKeys } from "../query-client";

function useUserTenants() {
  return useQuery({
    queryKey: queryKeys.tenants.all(),
    queryFn: () => apiClient.get<Tenant[]>("/tenants", { tenantScoped: false }),
    staleTime: 2 * 60 * 1000,
  });
}

function useTenant(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.detail(tenantId),
    queryFn: () => apiClient.get<Tenant>(`/tenants/${tenantId}`, { tenantScoped: false }),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

function useTenantMembers(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.members(tenantId),
    queryFn: () => {
      return apiClient.get<TenantMember[]>(`/tenants/${tenantId}/members`);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });
}

function useTenantSettings(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.settings(tenantId),
    queryFn: () => {
      return apiClient.get("/tenant/settings");
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

function useTenantBranding(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.branding(tenantId),
    queryFn: () => {
      return apiClient.get("/tenant/branding");
    },
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000,
  });
}

function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTenantRequest) =>
      apiClient.post<Tenant>("/tenants", data, { tenantScoped: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
    onError: (error) => {
      console.error("Create tenant failed:", error);
    },
  });
}

function useUpdateTenant(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTenantRequest) => {
      return apiClient.patch<Tenant>("/tenant", data);
    },
    onSuccess: () => {
      invalidateQueries.tenant(tenantId);
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
    onError: (error) => {
      console.error("Update tenant failed:", error);
    },
  });
}

function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tenantId: string) =>
      apiClient.delete(`/tenants/${tenantId}`, { tenantScoped: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
    onError: (error) => {
      console.error("Delete tenant failed:", error);
    },
  });
}

function useInviteMember(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: string }) => {
      return apiClient.post("/tenant/members/invite", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error("Invite member failed:", error);
    },
  });
}

function useUpdateMemberRole(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { memberId: string; role: string }) => {
      return apiClient.patch(`/tenant/members/${data.memberId}`, { role: data.role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error("Update member role failed:", error);
    },
  });
}

function useRemoveMember(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => {
      return apiClient.delete(`/tenant/members/${memberId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error("Remove member failed:", error);
    },
  });
}

function useUpdateTenantBranding(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      return apiClient.patch("/tenant/branding", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.branding(tenantId) });
    },
    onMutate: async (newBranding) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tenants.branding(tenantId) });

      const previousBranding = queryClient.getQueryData(queryKeys.tenants.branding(tenantId));

      queryClient.setQueryData(queryKeys.tenants.branding(tenantId), (old: any) => ({
        ...old,
        ...newBranding,
      }));

      return { previousBranding, newBranding };
    },
    onError: (error, newBranding, context) => {
      console.error("Update tenant branding failed:", error);
      if (context?.previousBranding) {
        queryClient.setQueryData(queryKeys.tenants.branding(tenantId), context.previousBranding);
      }
    },
  });
}

function useTenantInvitations(tenantId: string) {
  return useQuery({
    queryKey: ["tenants", tenantId, "invitations"],
    queryFn: () => {
      return Promise.resolve([]);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
  });
}

function useInvitationByToken(token: string) {
  return useQuery({
    queryKey: ["invitations", "token", token],
    queryFn: () => Promise.resolve(null),
    enabled: !!token,
    staleTime: 5 * 60 * 1000,
  });
}

function useCreateInvitation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      return Promise.resolve({ id: "invite-" + Date.now(), ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "invitations"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error("Create invitation failed:", error);
    },
  });
}

function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => Promise.resolve({ accepted: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (error) => {
      console.error("Accept invitation failed:", error);
    },
  });
}

function useDeclineInvitation() {
  return useMutation({
    mutationFn: (token: string) => Promise.resolve({ declined: true }),
    onError: (error) => {
      console.error("Decline invitation failed:", error);
    },
  });
}

function useCancelInvitation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => {
      return Promise.resolve({ cancelled: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants", tenantId, "invitations"] });
    },
    onError: (error) => {
      console.error("Cancel invitation failed:", error);
    },
  });
}

function useUpdateTenantSettings(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      return apiClient.patch("/tenant/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.settings(tenantId) });
    },
    onError: (error) => {
      console.error("Update tenant settings failed:", error);
    },
  });
}

function useUpdateTenantBilling(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      return apiClient.patch("/tenant/billing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(tenantId) });
    },
    onError: (error) => {
      console.error("Update tenant billing failed:", error);
    },
  });
}
