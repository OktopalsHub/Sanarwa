import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity("topics")
@Unique(["tenantId", "name"])
@Index(["tenantId"])
export class Topic {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId: string;

  @Column({ type: "uuid", nullable: true, name: "project_id" })
  projectId?: string;

  @Column({ length: 120 })
  name: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

@Entity("topic_subscriptions")
@Unique(["topicId", "subscriberId"])
@Index(["topicId"])
@Index(["subscriberId"])
export class TopicSubscription {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "topic_id" })
  @Index()
  topicId: string;

  @Column({ name: "subscriber_id", type: "varchar", length: 255 })
  subscriberId: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
