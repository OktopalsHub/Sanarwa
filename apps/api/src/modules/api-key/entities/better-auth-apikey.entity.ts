import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";

@Entity("apikey")
@Index(["referenceId"])
@Index(["key"])
export class BetterAuthApiKey extends BaseEntity {
  @Column({ name: "config_id", type: "text", default: "organization" })
  configId: string;

  @Column({ name: "name", type: "text", nullable: true })
  name?: string | null;

  @Column({ name: "start", type: "text", nullable: true })
  start?: string | null;

  @Column({ name: "reference_id", type: "varchar", length: 36 })
  referenceId: string;

  @Column({ name: "prefix", type: "text", nullable: true })
  prefix?: string | null;

  @Column({ name: "key", type: "text" })
  key: string;

  @Column({ name: "enabled", type: "boolean", default: true })
  enabled: boolean;

  @Column({ name: "rate_limit_enabled", type: "boolean", default: true })
  rateLimitEnabled: boolean;

  @Column({ name: "rate_limit_time_window", type: "integer", nullable: true })
  rateLimitTimeWindow?: number | null;

  @Column({ name: "rate_limit_max", type: "integer", nullable: true })
  rateLimitMax?: number | null;

  @Column({ name: "request_count", type: "integer", default: 0 })
  requestCount: number;

  @Column({ name: "remaining", type: "integer", nullable: true })
  remaining?: number | null;

  @Column({ name: "last_request", type: "timestamp", nullable: true })
  lastRequest?: Date | null;

  @Column({ name: "expires_at", type: "timestamp", nullable: true })
  expiresAt?: Date | null;

  @Column({ name: "permissions", type: "text", nullable: true })
  permissions?: string | null;

  @Column({ name: "metadata", type: "text", nullable: true })
  metadata?: string | null;
}
