import { Column, DeleteDateColumn, Entity, OneToMany } from "typeorm";
import { BaseEntity } from "../../../database/entities/base.entity";
import { Account } from "../../auth/entities/account.entity";
import { Session } from "../../auth/entities/session.entity";
import { Tenant } from "../../tenant/entities/tenant.entity";

@Entity("user")
export class User extends BaseEntity {
  @Column({ length: 100, unique: true })
  email: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  password?: string | null;

  @Column({ name: "email_verified", default: false })
  emailVerified: boolean;

  @Column({ length: 100 })
  name: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  image?: string | null;

  @DeleteDateColumn({ name: "deleted_at", type: "timestamp" })
  deletedAt: Date;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => Account, (account) => account.user)
  accounts: Account[];

  @OneToMany(() => Tenant, (tenant) => tenant.owner)
  tenants: Tenant[];
}
