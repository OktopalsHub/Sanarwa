import { BaseEntity } from "../../../database/entities/base.entity";
import { Entity, Column, Index } from "typeorm";

@Entity("verification")
@Index(["identifier", "token"], { unique: true })
export class Verification extends BaseEntity {
  @Column({ type: "varchar", length: 100 })
  identifier: string;

  @Column({ type: "varchar", length: 255, unique: true })
  token: string;

  @Column({ name: "expires_at", type: "timestamp" })
  expiresAt: Date;
}
