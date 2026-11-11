import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MessageDelivery, DeliveryTransportStatus } from "../messaging/message-delivery.entity";
import { ProjectSendQuota } from "./entities/project-send-quota.entity";

export type ProjectQuotaVerdict =
  | { allowed: true; quota: ProjectSendQuota | null }
  | {
      allowed: false;
      reason: "project_quota";
      used: number;
      limit: number;
      windowSeconds: number;
      resetAt: Date;
    };

export interface ProjectQuotaStatus {
  projectId: string;
  tenantId: string;
  configured: boolean;
  enabled: boolean;
  limit: number | null;
  windowSeconds: number | null;
  used: number;
  remaining: number | null;
  resetAt: Date | null;
}

const COUNTED_TRANSPORT_STATUSES = [DeliveryTransportStatus.PENDING, DeliveryTransportStatus.SENT];

/**
 * Burst protection keyed by project. Usage is the count of dispatched
 * deliveries (pending/sent/delivered) in the trailing window, so skipped or
 * blocked attempts don't consume quota and can't keep the window full.
 *
 * The check is read-then-send, so concurrent sends can overshoot by the number
 * of in-flight requests. That is intentional: this is burst protection, not
 * strict accounting — the tenant token wallet remains the billing authority.
 */
@Injectable()
export class ProjectQuotaService {
  private readonly logger = new Logger(ProjectQuotaService.name);

  constructor(
    @InjectRepository(ProjectSendQuota)
    private readonly quotas: Repository<ProjectSendQuota>,
    @InjectRepository(MessageDelivery)
    private readonly deliveries: Repository<MessageDelivery>,
  ) {}

  async getQuota(projectId: string): Promise<ProjectSendQuota | null> {
    return this.quotas.findOne({ where: { projectId } });
  }

  async checkQuota(input: {
    tenantId: string;
    projectId?: string;
    excludeDeliveryId?: string;
    now?: Date;
  }): Promise<ProjectQuotaVerdict> {
    if (!input.projectId) {
      return { allowed: true, quota: null };
    }

    const quota = await this.getQuota(input.projectId);
    if (!quota || !quota.enabled || quota.tenantId !== input.tenantId) {
      return { allowed: true, quota };
    }

    const now = input.now ?? new Date();
    const used = await this.countUsed(
      input.tenantId,
      input.projectId,
      quota.windowSeconds,
      now,
      input.excludeDeliveryId,
    );

    if (used >= quota.limit) {
      return {
        allowed: false,
        reason: "project_quota",
        used,
        limit: quota.limit,
        windowSeconds: quota.windowSeconds,
        resetAt: new Date(now.getTime() + quota.windowSeconds * 1000),
      };
    }

    return { allowed: true, quota };
  }

  async getStatus(projectId: string, tenantId: string): Promise<ProjectQuotaStatus> {
    const quota = await this.getQuota(projectId);
    if (!quota || quota.tenantId !== tenantId || !quota.enabled) {
      return {
        projectId,
        tenantId,
        configured: Boolean(quota && quota.tenantId === tenantId),
        enabled: Boolean(quota?.enabled && quota.tenantId === tenantId),
        limit: null,
        windowSeconds: null,
        used: 0,
        remaining: null,
        resetAt: null,
      };
    }

    const now = new Date();
    const used = await this.countUsed(tenantId, projectId, quota.windowSeconds, now);
    return {
      projectId,
      tenantId,
      configured: true,
      enabled: true,
      limit: quota.limit,
      windowSeconds: quota.windowSeconds,
      used,
      remaining: Math.max(0, quota.limit - used),
      resetAt: new Date(now.getTime() + quota.windowSeconds * 1000),
    };
  }

  async upsertQuota(input: {
    tenantId: string;
    projectId: string;
    limit: number;
    windowSeconds: number;
    enabled?: boolean;
  }): Promise<ProjectSendQuota> {
    const existing = await this.getQuota(input.projectId);
    if (existing) {
      existing.tenantId = input.tenantId;
      existing.limit = input.limit;
      existing.windowSeconds = input.windowSeconds;
      if (input.enabled !== undefined) {
        existing.enabled = input.enabled;
      }
      return this.quotas.save(existing);
    }

    return this.quotas.save(
      this.quotas.create({
        projectId: input.projectId,
        tenantId: input.tenantId,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
        enabled: input.enabled ?? true,
      }),
    );
  }

  async deleteQuota(projectId: string): Promise<void> {
    await this.quotas.delete({ projectId });
  }

  private async countUsed(
    tenantId: string,
    projectId: string,
    windowSeconds: number,
    now: Date,
    excludeDeliveryId?: string,
  ): Promise<number> {
    const since = new Date(now.getTime() - windowSeconds * 1000);
    const builder = this.deliveries
      .createQueryBuilder("delivery")
      .where("delivery.tenantId = :tenantId", { tenantId })
      .andWhere("delivery.transportStatus IN (:...statuses)", {
        statuses: COUNTED_TRANSPORT_STATUSES,
      })
      .andWhere("delivery.createdAt >= :since", { since })
      .andWhere("delivery.metadata->>'projectId' = :projectId", { projectId });

    if (excludeDeliveryId) {
      builder.andWhere("delivery.id != :excludeDeliveryId", { excludeDeliveryId });
    }

    return builder.getCount();
  }
}
