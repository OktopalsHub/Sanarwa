import { Invitation, Tenant, TenantMember } from "./models";

export interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  memberships: TenantMember[];
  invitations: Invitation[];
  isLoading: boolean;
  error: string | null;
}

