import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InAppNotification } from "../../messaging/entities/in-app-notification.entity";

export interface FeedQuery {
  tenantId: string;
  subscriberId: string;
  feedId?: string;
  page?: number;
  limit?: number;
  seen?: boolean;
  read?: boolean;
  archived?: boolean;
}

@Injectable()
export class InAppFeedService {
  private readonly logger = new Logger(InAppFeedService.name);

  constructor(
    @InjectRepository(InAppNotification)
    private readonly repo: Repository<InAppNotification>,
  ) {}

  async getFeed(query: FeedQuery): Promise<{
    data: InAppNotification[];
    total: number;
    hasMore: boolean;
    unseenCount: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const feedId = query.feedId || "default";
    const page = query.page || 0;
    const limit = Math.min(query.limit || 20, 100);
    const qb = this.repo
      .createQueryBuilder("n")
      .where("n.tenant_id = :tenantId", { tenantId: query.tenantId })
      .andWhere("(n.subscriber_id = :sid OR n.user_id = :sid)", { sid: query.subscriberId })
      .andWhere("n.feed_id = :feedId", { feedId });

    if (query.seen !== undefined) qb.andWhere("n.seen = :seen", { seen: query.seen });
    if (query.read !== undefined) {
      if (query.read) qb.andWhere("n.status = :readStatus", { readStatus: "read" });
      else qb.andWhere("n.status != :readStatus", { readStatus: "read" });
    }
    if (query.archived !== undefined) qb.andWhere("n.archived = :archived", { archived: query.archived });
    else qb.andWhere("n.archived = false");

    qb.orderBy("n.created_at", "DESC")
      .skip(page * limit)
      .take(limit + 1);

    const [rowsPlusOne, totalFiltered] = await Promise.all([
      qb.getMany(),
      this.repo
        .createQueryBuilder("n")
        .where("n.tenant_id = :tenantId", { tenantId: query.tenantId })
        .andWhere("(n.subscriber_id = :sid OR n.user_id = :sid)", { sid: query.subscriberId })
        .andWhere("n.feed_id = :feedId", { feedId })
        .andWhere("n.archived = false")
        .getCount(),
    ]);

    const hasMore = rowsPlusOne.length > limit;
    const data = hasMore ? rowsPlusOne.slice(0, limit) : rowsPlusOne;

    const [unseenCount, unreadCount] = await Promise.all([
      this.repo
        .createQueryBuilder("n")
        .where("n.tenant_id = :tenantId", { tenantId: query.tenantId })
        .andWhere("(n.subscriber_id = :sid OR n.user_id = :sid)", { sid: query.subscriberId })
        .andWhere("n.feed_id = :feedId", { feedId })
        .andWhere("n.seen = false")
        .andWhere("n.archived = false")
        .getCount(),
      this.repo
        .createQueryBuilder("n")
        .where("n.tenant_id = :tenantId", { tenantId: query.tenantId })
        .andWhere("(n.subscriber_id = :sid OR n.user_id = :sid)", { sid: query.subscriberId })
        .andWhere("n.feed_id = :feedId", { feedId })
        .andWhere("n.status != :readStatus", { readStatus: "read" })
        .andWhere("n.archived = false")
        .getCount(),
    ]);

    return { data, total: totalFiltered, hasMore, unseenCount, unreadCount, page, limit };
  }

  async getUnseenCount(tenantId: string, subscriberId: string, feedId = "default"): Promise<number> {
    return this.repo
      .createQueryBuilder("n")
      .where("n.tenant_id = :tenantId", { tenantId })
      .andWhere("(n.subscriber_id = :sid OR n.user_id = :sid)", { sid: subscriberId })
      .andWhere("n.feed_id = :feedId", { feedId })
      .andWhere("n.seen = false")
      .andWhere("n.archived = false")
      .getCount();
  }

  async markSeen(tenantId: string, subscriberId: string, ids?: string[], feedId?: string): Promise<number> {
    const qb = this.repo
      .createQueryBuilder()
      .update(InAppNotification)
      .set({ seen: true, seenAt: new Date() } as any)
      .where("tenant_id = :tenantId", { tenantId })
      .andWhere("(subscriber_id = :sid OR user_id = :sid)", { sid: subscriberId })
      .andWhere("seen = false")
      .andWhere("archived = false");
    if (ids?.length) qb.andWhere("id IN (:...ids)", { ids });
    else if (feedId) qb.andWhere("feed_id = :feedId", { feedId });
    const r = await qb.execute();
    return r.affected || 0;
  }

  async markRead(tenantId: string, subscriberId: string, ids: string[]): Promise<number> {
    if (!ids?.length) return 0;
    const r = await this.repo
      .createQueryBuilder()
      .update(InAppNotification)
      .set({ status: "read" as any, readAt: new Date(), seen: true, seenAt: new Date() } as any)
      .where("tenant_id = :tenantId", { tenantId })
      .andWhere("(subscriber_id = :sid OR user_id = :sid)", { sid: subscriberId })
      .andWhere("id IN (:...ids)", { ids })
      .execute();
    return r.affected || 0;
  }

  async markArchived(tenantId: string, subscriberId: string, ids: string[], archived: boolean): Promise<number> {
    const r = await this.repo
      .createQueryBuilder()
      .update(InAppNotification)
      .set({ archived, archivedAt: archived ? new Date() : null } as any)
      .where("tenant_id = :tenantId", { tenantId })
      .andWhere("(subscriber_id = :sid OR user_id = :sid)", { sid: subscriberId })
      .andWhere("id IN (:...ids)", { ids })
      .execute();
    return r.affected || 0;
  }

  async markAllSeen(tenantId: string, subscriberId: string, feedId = "default"): Promise<number> {
    return this.markSeen(tenantId, subscriberId, undefined, feedId);
  }

  async markAllRead(tenantId: string, subscriberId: string, feedId = "default"): Promise<number> {
    const r = await this.repo
      .createQueryBuilder()
      .update(InAppNotification)
      .set({ status: "read" as any, readAt: new Date(), seen: true, seenAt: new Date() } as any)
      .where("tenant_id = :tenantId", { tenantId })
      .andWhere("(subscriber_id = :sid OR user_id = :sid)", { sid: subscriberId })
      .andWhere("feed_id = :feedId", { feedId })
      .andWhere("status != :read", { read: "read" })
      .andWhere("archived = false")
      .execute();
    return r.affected || 0;
  }
}
