import { InviteStatus, TenantMemberRole } from "./enums";
import { Invitation } from "./models";

export type TenantRole = TenantMemberRole;
export type Permission = string;
export type InvitationStatus = InviteStatus;
export interface TenantInvitation extends Invitation {}
