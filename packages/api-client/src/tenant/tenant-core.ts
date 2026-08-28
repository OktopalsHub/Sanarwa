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
export class TenantCoreClient extends ApiClientConsumer {
  // Core Tenant Management Methods

  /**
   * Get all tenants with optional filtering and pagination
   * @param params Query parameters for filtering and pagination
   * @returns List of tenants
   */
  async getTenants(params?: TenantQueryParams): Promise<Tenant[]> {
    return this.apiClient.get<Tenant[]>("/tenants", params, { tenantScoped: false });
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
    return this.apiClient.post<Tenant>("/tenants", data, { tenantScoped: false });
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
    return this.apiClient.post<Tenant>(
      `/tenants/${tenantId}/activate`,
      {},
      { tenantScoped: false },
    );
  }

  /**
   * Get current tenant profile (requires tenant context)
   * @returns Current tenant profile
   */
  async getCurrentTenantProfile(): Promise<Tenant> {
    return this.apiClient.get<Tenant>("/tenants/me/profile");
  }

}
