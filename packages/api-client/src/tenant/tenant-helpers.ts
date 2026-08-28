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
import { TenantContextClient } from "./tenant-context";

export class TenantHelpersClient extends TenantContextClient {
  // Utility Methods

  /**
   * Create a tenant-scoped API client for a specific tenant
   * @param tenantId Tenant ID to scope the client to
   * @returns New API client instance scoped to the tenant
   */
  createTenantScopedClient(tenantId: string): TenantHelpersClient {
    const scopedApiClient = createApiClient({ tenantId });
    return new TenantHelpersClient(scopedApiClient);
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
    action: "update" | "remove",
  ): boolean {
    const roleHierarchy = ["viewer", "member", "admin", "owner"];
    const currentRoleIndex = roleHierarchy.indexOf(currentUserRole);
    const targetRoleIndex = roleHierarchy.indexOf(targetMemberRole);

    // Only admins and owners can manage members
    if (currentRoleIndex < 2) return false;

    // Owners can manage anyone except other owners (for removal)
    if (currentUserRole === "owner") {
      return !(action === "remove" && targetMemberRole === "owner");
    }

    // Admins can only manage members and viewers
    if (currentUserRole === "admin") {
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

  // Additional methods needed by queries
  async getCurrentUserMembership(tenantId: string): Promise<TenantMember> {
    return this.apiClient.get<TenantMember>(`/tenants/${tenantId}/membership`);
  }

  async getTenantSettings(tenantId: string): Promise<any> {
    return this.apiClient.get<any>(`/tenants/${tenantId}/settings`);
  }
}
