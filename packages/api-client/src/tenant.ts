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
  UpdateTenantRequest,
} from "./types/tenant";
import { ApiClient, apiClient as sharedApiClient, createApiClient } from "./client";

export interface TenantMembership {
  membershipId?: string;
  tenantId: string;
  userId?: string;
  role?: string;
  status?: string;
  tenant: Tenant;
}

export class TenantApiClient {
  private apiClient: ApiClient;

  constructor(apiClient?: ApiClient) {
    this.apiClient = apiClient ?? sharedApiClient;
  }

  async getMyMemberships(params?: { page?: number; limit?: number }): Promise<TenantMembership[]> {
    const response = await this.apiClient.get<
      | Tenant[]
      | {
          records: Array<{
            tenant?: Tenant;
            role?: string;
            id?: string;
            status?: string;
            user?: { id?: string };
          }>;
        }
    >("/tenants/me", params, { tenantScoped: false });

    if (Array.isArray(response)) {
      return response
        .filter((tenant) => Boolean(tenant?.id))
        .map((tenant) => ({ tenantId: tenant.id, tenant }));
    }

    return (response.records ?? [])
      .filter((record) => Boolean(record.tenant?.id))
      .map((record) => ({
        membershipId: record.id,
        tenantId: record.tenant!.id,
        userId: record.user?.id,
        role: record.role,
        status: record.status,
        tenant: record.tenant!,
      }));
  }

  async getMyTenants(params?: { page?: number; limit?: number }): Promise<Tenant[]> {
    const memberships = await this.getMyMemberships(params);
    return memberships.map((membership) => membership.tenant);
  }

  async getTenants(params?: TenantQueryParams): Promise<Tenant[]> {
    return this.apiClient.get<Tenant[]>("/tenants", params, { tenantScoped: false });
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    return this.apiClient.get<Tenant>(`/tenants/${tenantId}`, {}, { tenantScoped: false });
  }

  async createTenant(data: CreateTenantRequest): Promise<Tenant> {
    return this.apiClient.post<Tenant>("/tenants", data, { tenantScoped: false });
  }

  async updateTenant(tenantId: string, data: UpdateTenantRequest): Promise<Tenant> {
    return this.apiClient.patch<Tenant>(`/tenants/${tenantId}`, data, { tenantScoped: false });
  }

  async deleteTenant(tenantId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/${tenantId}`, { tenantScoped: false });
  }

  async suspendTenant(tenantId: string): Promise<Tenant> {
    return this.apiClient.post<Tenant>(`/tenants/${tenantId}/suspend`, {}, { tenantScoped: false });
  }

  async activateTenant(tenantId: string): Promise<Tenant> {
    return this.apiClient.post<Tenant>(
      `/tenants/${tenantId}/activate`,
      {},
      { tenantScoped: false },
    );
  }

  async getCurrentTenantProfile(): Promise<Tenant> {
    return this.apiClient.get<Tenant>("/tenants/me/profile");
  }

  async getTenantMembers(tenantId?: string): Promise<TenantMember[]> {
    if (tenantId) {
      return this.apiClient.get<TenantMember[]>(
        `/tenants/${tenantId}/members`,
        {},
        { tenantScoped: false },
      );
    }
    return this.apiClient.get<TenantMember[]>("/tenants/:tenantId/me/members");
  }

  async getTenantMember(memberId: string): Promise<TenantMember> {
    return this.apiClient.get<TenantMember>(`/tenants/:tenantId/me/members/${memberId}`);
  }

  async addTenantMember(data: CreateTenantMemberRequest): Promise<TenantMember> {
    return this.apiClient.post<TenantMember>("/tenants/:tenantId/me/members", data);
  }

  async updateTenantMember(
    memberId: string,
    data: UpdateTenantMemberRequest,
  ): Promise<TenantMember> {
    return this.apiClient.patch<TenantMember>(`/tenants/:tenantId/me/members/${memberId}`, data);
  }

  async removeTenantMember(memberId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/:tenantId/me/members/${memberId}`);
  }

  async inviteMember(tenantId: string, data: InviteMemberRequest): Promise<Invitation> {
    return this.apiClient.post<Invitation>(`/tenants/${tenantId}/invites`, data, {
      tenantScoped: false,
    });
  }

  async createInvitation(data: InviteMemberRequest): Promise<Invitation> {
    return this.apiClient.post<Invitation>("/invites", data);
  }

  async getTenantInvitations(): Promise<Invitation[]> {
    return this.apiClient.get<Invitation[]>("/invites");
  }

  async getInvitationByToken(token: string): Promise<Invitation> {
    return this.apiClient.get<Invitation>(`/invites/${token}`, {}, { tenantScoped: false });
  }

  async acceptInvitation(data: AcceptInviteRequest): Promise<TenantMember> {
    return this.apiClient.post<TenantMember>("/invites/accept", data, { tenantScoped: false });
  }

  async declineInvitation(token: string): Promise<void> {
    return this.apiClient.post<void>(`/invites/${token}/decline`, {}, { tenantScoped: false });
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    return this.apiClient.delete<void>(`/invites/${invitationId}`);
  }

  async setCurrentTenant(tenantId: string | null): Promise<void> {
    this.apiClient.setTenant(tenantId);
  }

  async getCurrentTenant(): Promise<Tenant> {
    return this.apiClient.get<Tenant>("/tenants/current", {}, { tenantScoped: false });
  }

  getCurrentTenantId(): string | undefined {
    return this.apiClient.getTenant();
  }

  hasTenantContext(): boolean {
    return !!this.apiClient.getTenant();
  }

  clearTenantContext(): void {
    this.apiClient.setTenant(null);
  }

  createTenantScopedClient(tenantId: string): TenantApiClient {
    const scopedApiClient = createApiClient({ tenantId });
    return new TenantApiClient(scopedApiClient);
  }

  canManageMember(
    currentUserRole: string,
    targetMemberRole: string,
    action: "update" | "remove",
  ): boolean {
    const roleHierarchy = ["viewer", "member", "admin", "owner"];
    const currentRoleIndex = roleHierarchy.indexOf(currentUserRole);
    const targetRoleIndex = roleHierarchy.indexOf(targetMemberRole);

    if (currentRoleIndex < 2) return false;

    if (currentUserRole === "owner") {
      return !(action === "remove" && targetMemberRole === "owner");
    }

    if (currentUserRole === "admin") {
      return targetRoleIndex < 2;
    }

    return false;
  }

  validateTenantData(data: CreateTenantRequest | UpdateTenantRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if ("name" in data && data.name) {
      if (data.name.length < 2) {
        errors.push("Tenant name must be at least 2 characters long");
      }
      if (data.name.length > 100) {
        errors.push("Tenant name must be less than 100 characters");
      }
    }

    if ("subdomain" in data && data.subdomain) {
      const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!subdomainRegex.test(data.subdomain)) {
        errors.push("Subdomain must contain only lowercase letters, numbers, and hyphens");
      }
      if (data.subdomain.length < 3 || data.subdomain.length > 63) {
        errors.push("Subdomain must be between 3 and 63 characters");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getCurrentUserMembership(tenantId: string): Promise<TenantMember> {
    return this.apiClient.get<TenantMember>(`/tenants/${tenantId}/membership`);
  }

  async getTenantSettings(tenantId: string): Promise<any> {
    return this.apiClient.get<any>(`/tenants/${tenantId}/settings`);
  }
}

export const tenantApi = new TenantApiClient();
