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
} from "../types/tenant";
import { ApiClient, createApiClient } from "../client";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { TenantCoreClient } from "./tenant-core";

export class TenantMembersClient extends TenantCoreClient {
  // Tenant Member Management Methods

  /**
   * Get all members of the current tenant
   * @returns List of tenant members
   */
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
    return this.apiClient.post<TenantMember>("/tenants/:tenantId/me/members", data);
  }

  /**
   * Update a tenant member's role and permissions
   * @param memberId Member ID to update
   * @param data Member update data
   * @returns Updated tenant member
   */
  async updateTenantMember(
    memberId: string,
    data: UpdateTenantMemberRequest,
  ): Promise<TenantMember> {
    return this.apiClient.patch<TenantMember>(`/tenants/:tenantId/me/members/${memberId}`, data);
  }

  /**
   * Remove a member from the current tenant
   * @param memberId Member ID to remove
   */
  async removeTenantMember(memberId: string): Promise<void> {
    return this.apiClient.delete<void>(`/tenants/:tenantId/me/members/${memberId}`);
  }

}
