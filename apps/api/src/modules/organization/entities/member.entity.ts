import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";
import { User } from "../../user/entities/user.entity";
import { Organization } from "./organization.entity";

@Entity("member")
@Index(["organizationId", "userId"], { unique: true })
@Index(["organizationId"])
@Index(["userId"])
export class Member extends BaseEntity {
  @Column({ name: "organization_id", type: "varchar", length: 36 })
  organizationId: string;

  @Column({ name: "user_id", type: "varchar", length: 36 })
  userId: string;

  @Column({ name: "role", type: "text", default: "member" })
  role: string;

  @Column({ name: "name", type: "text", nullable: true })
  name?: string | null;

  @Column({ name: "avatar", type: "text", nullable: true })
  avatar?: string | null;

  @ManyToOne(() => Organization, { onDelete: "CASCADE" })
  @JoinColumn({ name: "organization_id" })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
