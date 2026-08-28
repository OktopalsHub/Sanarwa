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
import { TenantInvitesClient } from "./tenant-invites";

export class TenantContextClient extends TenantInvitesClient {
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
    return this.apiClient.get<Tenant>("/tenants/current", {}, { tenantScoped: false });
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

}
