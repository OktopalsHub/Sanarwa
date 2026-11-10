import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../common/database/entities/base.entity";

@Entity("organization")
@Index(["slug"], { unique: true })
export class Organization extends BaseEntity {
  @Column({ name: "name", type: "text" })
  name: string;

  @Column({ name: "slug", type: "text", unique: true })
  slug: string;

  @Column({ name: "logo", type: "text", nullable: true })
  logo?: string | null;

  @Column({ name: "metadata", type: "text", nullable: true })
  metadata?: string | null;
}
