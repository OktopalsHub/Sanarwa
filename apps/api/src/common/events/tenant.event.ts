import { Tenant } from "../../modules/tenant/entities/tenant.entity";
import { User } from "../../modules/user/entities/user.entity";

export class TenantCreatedEvent {
  constructor(
    public readonly tenant: Tenant,
    public readonly creator: User,
  ) {}
}

export class TenantMemberCreatedEvent {
  constructor(
    public readonly tenantId: string,
    public readonly userId: string,
    public readonly role: string,
  ) {}
}
