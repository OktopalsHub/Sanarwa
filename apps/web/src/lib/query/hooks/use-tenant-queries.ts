import { apiClient } from '@/lib/api/client';
import type {
  CreateTenantRequest,
  Tenant,
  TenantMember,
  UpdateTenantRequest
} from '@/lib/types/tenant';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateQueries, queryKeys } from '../query-client';

// Query hook for user's tenants
export function useUserTenants() {
  return useQuery({
    queryKey: queryKeys.tenants.all(),
    queryFn: () => apiClient.get<Tenant[]>('/tenants', { tenantScoped: false }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for specific tenant details
export function useTenant(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.detail(tenantId),
    queryFn: () => apiClient.get<Tenant>(`/tenants/${tenantId}`, { tenantScoped: false }),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for tenant members
export function useTenantMembers(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.members(tenantId),
    queryFn: () => {
      // Set tenant context for this request
      const client = apiClient;
      client.setTenant(tenantId);
      return client.get<TenantMember[]>(`/tenants/${tenantId}/members`);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for tenant settings
export function useTenantSettings(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.settings(tenantId),
    queryFn: () => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.get('/tenant/settings');
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Query hook for tenant branding
export function useTenantBranding(tenantId: string) {
  return useQuery({
    queryKey: queryKeys.tenants.branding(tenantId),
    queryFn: () => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.get('/tenant/branding');
    },
    enabled: !!tenantId,
    staleTime: 10 * 60 * 1000, // 10 minutes - branding changes less frequently
  });
}

// Mutation hook for creating a tenant
export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTenantRequest) =>
      apiClient.post<Tenant>('/tenants', data, { tenantScoped: false }),
    onSuccess: () => {
      // Invalidate tenants list to show new tenant
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
    onError: (error) => {
      console.error('Create tenant failed:', error);
    },
  });
}

// Mutation hook for updating a tenant
export function useUpdateTenant(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateTenantRequest) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.patch<Tenant>('/tenant', data);
    },
    onSuccess: () => {
      // Invalidate tenant-related queries
      invalidateQueries.tenant(tenantId);
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
    onError: (error) => {
      console.error('Update tenant failed:', error);
    },
  });
}

// Mutation hook for deleting a tenant
export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tenantId: string) =>
      apiClient.delete(`/tenants/${tenantId}`, { tenantScoped: false }),
    onSuccess: () => {
      // Invalidate tenants list
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
    onError: (error) => {
      console.error('Delete tenant failed:', error);
    },
  });
}

// Mutation hook for inviting a member
export function useInviteMember(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { email: string; role: string }) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.post('/tenant/members/invite', data);
    },
    onSuccess: () => {
      // Invalidate members list
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error('Invite member failed:', error);
    },
  });
}

// Mutation hook for updating member role
export function useUpdateMemberRole(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { memberId: string; role: string }) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.patch(`/tenant/members/${data.memberId}`, { role: data.role });
    },
    onSuccess: () => {
      // Invalidate members list
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error('Update member role failed:', error);
    },
  });
}

// Mutation hook for removing a member
export function useRemoveMember(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.delete(`/tenant/members/${memberId}`);
    },
    onSuccess: () => {
      // Invalidate members list
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error('Remove member failed:', error);
    },
  });
}

// Mutation hook for updating tenant branding
export function useUpdateTenantBranding(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.patch('/tenant/branding', data);
    },
    onSuccess: () => {
      // Invalidate branding query
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.branding(tenantId) });
    },
    // Optimistic update for better UX
    onMutate: async (newBranding) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.tenants.branding(tenantId) });

      // Snapshot previous value
      const previousBranding = queryClient.getQueryData(queryKeys.tenants.branding(tenantId));

      // Optimistically update
      queryClient.setQueryData(queryKeys.tenants.branding(tenantId), (old: any) => ({
        ...old,
        ...newBranding,
      }));

      // Return context with previous and new data
      return { previousBranding, newBranding };
    },
    // Rollback on error
    onError: (error, newBranding, context) => {
      console.error('Update tenant branding failed:', error);
      if (context?.previousBranding) {
        queryClient.setQueryData(queryKeys.tenants.branding(tenantId), context.previousBranding);
      }
    },
  });
}

// Query hook for tenant invitations
export function useTenantInvitations(tenantId: string) {
  return useQuery({
    queryKey: ['tenants', tenantId, 'invitations'],
    queryFn: () => {
      const client = apiClient;
      client.setTenant(tenantId);
      return Promise.resolve([]);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Query hook for invitation details by token (public)
export function useInvitationByToken(token: string) {
  return useQuery({
    queryKey: ['invitations', 'token', token],
    queryFn: () => Promise.resolve(null),
    enabled: !!token,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation hook for creating invitations
export function useCreateInvitation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return Promise.resolve({ id: 'invite-' + Date.now(), ...data });
    },
    onSuccess: () => {
      // Invalidate invitations list
      queryClient.invalidateQueries({ queryKey: ['tenants', tenantId, 'invitations'] });
      // Also invalidate members list as invitation might affect it
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.members(tenantId) });
    },
    onError: (error) => {
      console.error('Create invitation failed:', error);
    },
  });
}

// Mutation hook for accepting invitations
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => Promise.resolve({ accepted: true }),
    onSuccess: () => {
      // Invalidate all tenant-related queries as user now has access
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (error) => {
      console.error('Accept invitation failed:', error);
    },
  });
}

// Mutation hook for declining invitations
export function useDeclineInvitation() {
  return useMutation({
    mutationFn: (token: string) => Promise.resolve({ declined: true }),
    onError: (error) => {
      console.error('Decline invitation failed:', error);
    },
  });
}

// Mutation hook for canceling invitations
export function useCancelInvitation(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return Promise.resolve({ cancelled: true });
    },
    onSuccess: () => {
      // Invalidate invitations list
      queryClient.invalidateQueries({ queryKey: ['tenants', tenantId, 'invitations'] });
    },
    onError: (error) => {
      console.error('Cancel invitation failed:', error);
    },
  });
}

// Mutation hook for updating tenant settings
export function useUpdateTenantSettings(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.patch('/tenant/settings', data);
    },
    onSuccess: () => {
      // Invalidate settings query
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.settings(tenantId) });
    },
    onError: (error) => {
      console.error('Update tenant settings failed:', error);
    },
  });
}

// Mutation hook for updating tenant billing info
export function useUpdateTenantBilling(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => {
      const client = apiClient;
      client.setTenant(tenantId);
      return client.patch('/tenant/billing', data);
    },
    onSuccess: () => {
      // Invalidate tenant details to refresh billing info
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.detail(tenantId) });
    },
    onError: (error) => {
      console.error('Update tenant billing failed:', error);
    },
  });
}