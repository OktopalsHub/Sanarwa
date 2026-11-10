import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Topic, TopicSubscription } from "./entities/topic.entity";

@Injectable()
export class TopicsService {
  private readonly logger = new Logger(TopicsService.name);

  constructor(
    @InjectRepository(Topic)
    private readonly topics: Repository<Topic>,
    @InjectRepository(TopicSubscription)
    private readonly subscriptions: Repository<TopicSubscription>,
  ) {}

  async ensureTopic(tenantId: string, name: string, projectId?: string): Promise<Topic> {
    const normalized = name.trim();
    const existing = await this.topics.findOne({ where: { tenantId, name: normalized } });
    if (existing) {
      return existing;
    }

    return this.topics.save(this.topics.create({ tenantId, projectId, name: normalized }));
  }

  async subscribe(
    tenantId: string,
    topic: string,
    subscriberId: string,
    projectId?: string,
  ): Promise<TopicSubscription> {
    const normalized = topic.trim();
    const resolved = await this.ensureTopic(tenantId, normalized, projectId);

    const existing = await this.subscriptions.findOne({
      where: { topicId: resolved.id, subscriberId },
    });
    if (existing) {
      return existing;
    }

    return this.subscriptions.save(
      this.subscriptions.create({ topicId: resolved.id, subscriberId }),
    );
  }

  async unsubscribe(tenantId: string, topic: string, subscriberId: string): Promise<number> {
    const resolved = await this.topics.findOne({ where: { tenantId, name: topic.trim() } });
    if (!resolved) {
      return 0;
    }

    const result = await this.subscriptions.delete({
      topicId: resolved.id,
      subscriberId,
    });
    return result.affected ?? 0;
  }

  async listSubscribers(tenantId: string, topic: string): Promise<string[]> {
    const resolved = await this.topics.findOne({ where: { tenantId, name: topic.trim() } });
    if (!resolved) {
      return [];
    }

    const rows = await this.subscriptions.find({ where: { topicId: resolved.id } });
    return rows.map((row) => row.subscriberId);
  }

  /**
   * GDPR/right-to-erasure: removes this subscriber from every topic owned by
   * the tenant. Scoped via the topic's tenant (subscriptions carry no tenantId).
   */
  async eraseSubscriber(tenantId: string, subscriberId: string): Promise<number> {
    const result = await this.subscriptions
      .createQueryBuilder()
      .delete()
      .where("subscriber_id = :subscriberId", { subscriberId })
      .andWhere("topic_id IN (SELECT id FROM topics WHERE tenant_id = :tenantId)", { tenantId })
      .execute();
    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Erased ${count} topic subscription(s) for subscriber ${subscriberId}`);
    }
    return count;
  }
}
