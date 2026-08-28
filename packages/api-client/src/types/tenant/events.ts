import { TenantMemberRole, TenantStatus } from "./enums";

export interface TenantCreatedEvent {
  tenantId: string;
  tenantName: string;
  userId: string;
  timestamp: Date;
}

export interface TenantMemberCreatedEvent {
  tenantId: string;
  memberId: string;
  userId: string;
  role: TenantMemberRole;
  timestamp: Date;
}

export interface InviteCreatedEvent {
  inviteId: string;
  tenantId: string;
  email: string;
  role: TenantMemberRole;
  invitedBy: string;
  timestamp: Date;
}

export interface InviteAcceptedEvent {
  inviteId: string;
  tenantId: string;
  userId: string;
  timestamp: Date;
}

export interface InviteDeclinedEvent {
  inviteId: string;
  tenantId: string;
  timestamp: Date;
}
