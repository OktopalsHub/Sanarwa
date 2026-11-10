import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";
import { User } from "../../user/entities/user.entity";
import { Organization } from "./organization.entity";

export type InvitationStatus = "pending" | "accepted" | "rejected" | "canceled";

@Entity("invitation")
@Index(["organizationId", "email"], { unique: true })
@Index(["organizationId"])
@Index(["email"])
export class Invitation extends BaseEntity {
  @Column({ name: "organization_id", type: "varchar", length: 36 })
  organizationId: string;

  @Column({ name: "email", type: "text" })
  email: string;

  @Column({ name: "role", type: "text", nullable: true })
  role?: string | null;

  @Column({ name: "status", type: "text", default: "pending" })
  status: InvitationStatus;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  @Column({ name: "inviter_id", type: "varchar", length: 36 })
  inviterId: string;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "inviter_id" })
  inviter: User;
}
