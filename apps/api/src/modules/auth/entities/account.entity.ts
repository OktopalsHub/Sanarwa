import { Entity, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { BaseEntity } from "../../../database/entities/base.entity";

@Entity("account")
@Index(["userId"])
@Index(["providerId", "accountId"], {
  unique: true,
  where: "provider_id IS NOT NULL AND account_id IS NOT NULL",
})
export class Account extends BaseEntity {
  @Column({ name: "user_id", type: "varchar", length: 36 })
  userId: string;

  @Column({ name: "account_id", type: "varchar", length: 255, nullable: true })
  accountId?: string | null;

  @Column({ name: "provider_id", type: "varchar", length: 255, nullable: true })
  providerId?: string | null;

  @Column({ name: "access_token", type: "text", nullable: true })
  accessToken?: string | null;

  @Column({ name: "refresh_token", type: "text", nullable: true })
  refreshToken?: string | null;

  @Column({ name: "id_token", type: "text", nullable: true })
  idToken?: string | null;

  @Column({ name: "access_token_expires_at", type: "timestamp", nullable: true })
  accessTokenExpiresAt?: Date | null;

  @Column({ name: "refresh_token_expires_at", type: "timestamp", nullable: true })
  refreshTokenExpiresAt?: Date | null;

  @Column({ type: "text", nullable: true })
  scope?: string | null;

  @Column({ type: "text", nullable: true })
  password?: string | null;

  @ManyToOne(() => User, (user) => user.accounts, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
