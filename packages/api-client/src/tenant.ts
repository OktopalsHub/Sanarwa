import {
  AcceptInviteRequest,
  CreateTenantMemberRequest,
  CreateTenantRequest,
  Invitation,
  InviteMemberRequest,
  Tenant,
  TenantMember,
  TenantQueryParams,
  UpdateTenantMemberRequest,
  UpdateTenantRequest
} from './types/tenant';
import { ApiClient, createApiClient } from './client';

/**
 * Tenant Management API client for handling all tenant-related operations
 * Implements tenant CRUD operations, member management, invitation system, and tenant switching
 */
class TenantApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    // Use provided client or create a new one
    this.apiClient = apiClient || createApiClient();
  }

  // Core Tenant Management Methods

  /**
   * Get all tenants with optional filtering and pagination
   * @param params Query parameters for filtering and pagination
   * @returns List of tenants
   */
  async getTenants(params?: TenantQueryParams): Promise<Tenant[]> {
    return this.apiClient.get<Tenant[]>('/tenants', params, { tenantScoped: false });
  }

  /**
   * Get a specific tenant by ID
   * @param tenantId Tenant ID
   * @returns Tenant details
   */
  async getTenant(tenantId: string): Promise<Tenant> {
    return this.apiClient.get<Tenant>(`/tenants/${tenantId}`, {}, { tenantScoped: false });
  }

  /**
   * Create a new tenant
   * @param data Tenant creation data
   * @returns Created tenant
   */
  async createTenant(data: CreateTenantRequest): Promise<Tenant> {
    return this.apiClient.post<Tenant>('/tenants', data, { tenantScoped: false });
  }

  /**
   * Update an existing tenant
   * @param tenantId Tenant ID to update
   * @param data Tenant update data
   * @returns Updated tenant
   */
  async updateTenant(tenantId: string, data: UpdateTenantRequest): Promise<Tenant> {
    return this.apiClient.patch<Tenant>(`/tenants/${tenantId}`, data, { tenantScoped: false });
  }

  /**
   * Delete a tenant
   * @param tenantId Tenant ID to delete
   */
  async deleteTenant(tenantId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/${tenantId}`, { tenantScoped: false });
  }

  /**
   * Suspend a tenant
   * @param tenantId Tenant ID to suspend
   * @returns Updated tenant
   */
  async suspendTenant(tenantId: string): Promise<Tenant> {
    return this.apiClient.post<Tenant>(`/tenants/${tenantId}/suspend`, {}, { tenantScoped: false });
  }

  /**
   * Activate a suspended tenant
   * @param tenantId Tenant ID to activate
   * @returns Updated tenant
   */
  async activateTenant(tenantId: string): Promise<Tenant> {
    return this.apiClient.post<Tenant>(`/tenants/${tenantId}/activate`, {}, { tenantScoped: false });
  }

  /**
   * Get current tenant profile (requires tenant context)
   * @returns Current tenant profile
   */
  async getCurrentTenantProfile(): Promise<Tenant> {
    return this.apiClient.get<Tenant>('/tenants/me/profile');
  }

  // Tenant Member Management Methods

  /**
   * Get all members of the current tenant
   * @returns List of tenant members
   */
  async getTenantMembers(tenantId?: string): Promise<TenantMember[]> {
    if (tenantId) {
      return this.apiClient.get<TenantMember[]>(`/tenants/${tenantId}/members`, {}, { tenantScoped: false });
    }
    return this.apiClient.get<TenantMember[]>('/tenants/:tenantId/me/members');
  }

  /**
   * Get a specific tenant member
   * @param memberId Member ID
   * @returns Tenant member details
   */
  async getTenantMember(memberId: string): Promise<TenantMember> {
    return this.apiClient.get<TenantMember>(`/tenants/:tenantId/me/members/${memberId}`);
  }

  /**
   * Add a new member to the current tenant
   * @param data Member creation data
   * @returns Created tenant member
   */
  async addTenantMember(data: CreateTenantMemberRequest): Promise<TenantMember> {
    return this.apiClient.post<TenantMember>('/tenants/:tenantId/me/members', data);
  }

  /**
   * Update a tenant member's role and permissions
   * @param memberId Member ID to update
   * @param data Member update data
   * @returns Updated tenant member
   */
  async updateTenantMember(memberId: string, data: UpdateTenantMemberRequest): Promise<TenantMember> {
    return this.apiClient.patch<TenantMember>(`/tenants/:tenantId/me/members/${memberId}`, data);
  }

  /**
   * Remove a member from the current tenant
   * @param memberId Member ID to remove
   */
  async removeTenantMember(memberId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/:tenantId/me/members/${memberId}`);
  }

  // Invitation Management Methods

  /**
   * Invite a member to the current tenant
   * @param tenantId Tenant ID
   * @param data Invitation data (email, role, permissions, etc.)
   * @returns Created invitation
   */
  async inviteMember(tenantId: string, data: InviteMemberRequest): Promise<Invitation> {
    return this.apiClient.post<Invitation>(`/tenants/${tenantId}/invites`, data, { tenantScoped: false });
  }

  /**
   * Create a new invitation for the current tenant
   * @param data Invitation data (email, role, permissions, etc.)
   * @returns Created invitation
   */
  async createInvitation(data: InviteMemberRequest): Promise<Invitation> {
    return this.apiClient.post<Invitation>('/invites', data);
  }

  /**
   * Get all invitations for the current tenant
   * @returns List of invitations
   */
  async getTenantInvitations(): Promise<Invitation[]> {
    return this.apiClient.get<Invitation[]>('/invites');
  }

  /**
   * Get invitation details by token (public endpoint)
   * @param token Invitation token
   * @returns Invitation details
   */
  async getInvitationByToken(token: string): Promise<Invitation> {
    return this.apiClient.get<Invitation>(`/invites/${token}`, {}, { tenantScoped: false });
  }

  /**
   * Accept an invitation (public endpoint)
   * @param data Accept invitation data with token
   * @returns Created tenant member
   */
  async acceptInvitation(data: AcceptInviteRequest): Promise<TenantMember> {
    return this.apiClient.post<TenantMember>('/invites/accept', data, { tenantScoped: false });
  }

  /**
   * Decline an invitation (public endpoint)
   * @param token Invitation token
   */
  async declineInvitation(token: string): Promise<void> {
    return this.apiClient.post<void>(`/invites/${token}/decline`, {}, { tenantScoped: false });
  }

  /**
   * Cancel an invitation (requires tenant context)
   * @param invitationId Invitation ID to cancel
   */
  async cancelInvitation(invitationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/invites/${invitationId}`);
  }

  // Tenant Context Management Methods

  /**
   * Set the current tenant context for the API client
   * This affects all subsequent API calls that require tenant scoping
   * @param tenantId Tenant ID to set as current context
   */
  async setCurrentTenant(tenantId: string | null): Promise<void> {
    this.apiClient.setTenant(tenantId);
  }

  /**
   * Get the current tenant
   * @returns Current tenant
   */
  async getCurrentTenant(): Promise<Tenant> {
    return this.apiClient.get<Tenant>('/tenants/current', {}, { tenantScoped: false });
  }

  /**
   * Get the current tenant ID from the API client context
   * @returns Current tenant ID or undefined if not set
   */
  getCurrentTenantId(): string | undefined {
    return this.apiClient.getTenant();
  }

  /**
   * Check if a tenant is currently selected
   * @returns True if a tenant is selected
   */
  hasTenantContext(): boolean {
    return !!this.apiClient.getTenant();
  }

  /**
   * Clear the current tenant context
   */
  clearTenantContext(): void {
    this.apiClient.setTenant(null);
  }

  // Utility Methods

  /**
   * Create a tenant-scoped API client for a specific tenant
   * @param tenantId Tenant ID to scope the client to
   * @returns New API client instance scoped to the tenant
   */
  createTenantScopedClient(tenantId: string): TenantApiClient {
    const scopedApiClient = createApiClient({ tenantId });
    return new TenantApiClient(scopedApiClient);
  }

  /**
   * Check if user has permission to perform an action on a tenant member
   * This is a client-side helper - server-side validation is still required
   * @param currentUserRole Current user's role in the tenant
   * @param targetMemberRole Target member's role
   * @param action Action to perform
   * @returns True if action is allowed
   */
  canManageMember(
    currentUserRole: string,
    targetMemberRole: string,
    action: 'update' | 'remove'
  ): boolean {
    const roleHierarchy = ['viewer', 'member', 'admin', 'owner'];
    const currentRoleIndex = roleHierarchy.indexOf(currentUserRole);
    const targetRoleIndex = roleHierarchy.indexOf(targetMemberRole);

    // Only admins and owners can manage members
    if (currentRoleIndex < 2) return false;

    // Owners can manage anyone except other owners (for removal)
    if (currentUserRole === 'owner') {
      return !(action === 'remove' && targetMemberRole === 'owner');
    }

    // Admins can only manage members and viewers
    if (currentUserRole === 'admin') {
      return targetRoleIndex < 2;
    }

    return false;
  }

  /**
   * Validate tenant data before sending to server
   * @param data Tenant data to validate
   * @returns Validation result with errors if any
   */
  validateTenantData(data: CreateTenantRequest | UpdateTenantRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if ('name' in data && data.name) {
      if (data.name.length < 2) {
        errors.push('Tenant name must be at least 2 characters long');
      }
      if (data.name.length > 100) {
        errors.push('Tenant name must be less than 100 characters');
      }
    }

    if ('subdomain' in data && data.subdomain) {
      const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!subdomainRegex.test(data.subdomain)) {
        errors.push('Subdomain must contain only lowercase letters, numbers, and hyphens');
      }
      if (data.subdomain.length < 3 || data.subdomain.length > 63) {
        errors.push('Subdomain must be between 3 and 63 characters');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Additional methods needed by queries
  async getCurrentUserMembership(tenantId: string): Promise<TenantMember> {
    return this.apiClient.get<TenantMember>(`/tenants/${tenantId}/membership`);
  }

  async getTenantSettings(tenantId: string): Promise<any> {
    return this.apiClient.get<any>(`/tenants/${tenantId}/settings`);
  }
}

export const tenantApi = new TenantApiClient();