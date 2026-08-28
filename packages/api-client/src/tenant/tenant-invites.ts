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
import { TenantMembersClient } from "./tenant-members";

export class TenantInvitesClient extends TenantMembersClient {
  // Invitation Management Methods

  /**
   * Invite a member to the current tenant
   * @param tenantId Tenant ID
   * @param data Invitation data (email, role, permissions, etc.)
   * @returns Created invitation
   */
  async inviteMember(tenantId: string, data: InviteMemberRequest): Promise<Invitation> {
    return this.apiClient.post<Invitation>(`/tenants/${tenantId}/invites`, data, {
      tenantScoped: false,
    });
  }

  /**
   * Create a new invitation for the current tenant
   * @param data Invitation data (email, role, permissions, etc.)
   * @returns Created invitation
   */
  async createInvitation(data: InviteMemberRequest): Promise<Invitation> {
    return this.apiClient.post<Invitation>("/invites", data);
  }

  /**
   * Get all invitations for the current tenant
   * @returns List of invitations
   */
  async getTenantInvitations(): Promise<Invitation[]> {
    return this.apiClient.get<Invitation[]>("/invites");
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
    return this.apiClient.post<TenantMember>("/invites/accept", data, { tenantScoped: false });
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

}
