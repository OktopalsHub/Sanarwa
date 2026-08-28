// Enums matching backend
export enum TenantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

export enum TenantMemberRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export enum TenantMemberStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  PENDING = "pending",
}

export enum InviteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
  CANCELLED = "cancelled",
}
