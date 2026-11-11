import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { TopicsService } from "../topics/topics.service";
import { UnifiedSendService } from "../messaging/unified-send.service";
import { SendUnifiedDto } from "../messaging/dto/unified-send.dto";
import { Campaign } from "./entities/campaign.entity";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";
import { CampaignQueryDto } from "./dto/campaign-query.dto";

const defaultAnalytics = {
  totalSent: 0,
  totalDelivered: 0,
  totalOpened: 0,
  totalClicked: 0,
  totalConverted: 0,
  deliveryRate: 0,
  openRate: 0,
  clickRate: 0,
  conversionRate: 0,
  channelBreakdown: [],
  lastUpdated: new Date(),
};

import { DELIVERABLE_CHANNELS } from "../../common/enums/notification-channel.enum";
const DISPATCHABLE_STATUSES = new Set(["draft", "scheduled", "active", "paused"]);

type CampaignMessage = {
  templateId?: string;
  subject?: string;
  data?: string;
  variables?: Record<string, any>;
};

export interface CampaignDispatchResult {
  campaignId: string;
  status: string;
  targeted: number;
  queued: number;
  failed: number;
  scheduledAt?: string;
  nextRunAt?: string;
  step?: number;
  trigger?: string;
}

export interface CampaignDispatchOptions {
  subscriberIds?: string[];
  variables?: Record<string, unknown>;
  trigger?: string;
}

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly topicsService: TopicsService,
    private readonly unifiedSendService: UnifiedSendService,
  ) {}

  async create(tenantId: string, dto: CreateCampaignDto, createdById?: string): Promise<Campaign> {
    const campaign = this.campaignRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description,
      type: dto.type || "one_time",
      status: dto.status || "draft",
      channels: dto.channels || [],
      audience: dto.audience || { type: "all" },
      schedule: dto.schedule || { type: "immediate" },
      templates: dto.templates || [],
      analytics: defaultAnalytics,
      createdById,
    });
    return this.campaignRepository.save(campaign);
  }

  async findAll(tenantId: string, query: CampaignQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const qb = this.campaignRepository
      .createQueryBuilder("campaign")
      .where("campaign.tenant_id = :tenantId", { tenantId });

    if (query.status) {
      qb.andWhere("campaign.status = :status", { status: query.status });
    }
    if (query.search) {
      qb.andWhere("(campaign.name ILIKE :search OR campaign.description ILIKE :search)", {
        search: `%${query.search}%`,
      });
    }

    const sortBy = query.sortBy || "createdAt";
    const sortOrder = (query.sortOrder || "desc").toUpperCase() as "ASC" | "DESC";
    qb.orderBy(`campaign.${sortBy}`, sortOrder);

    qb.skip((page - 1) * limit).take(limit);
    const [campaigns, total] = await qb.getManyAndCount();

    return {
      campaigns: campaigns.map((c) => this.toResponse(c)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string): Promise<Campaign> {
    const campaign = await this.campaignRepository.findOne({
      where: { id, tenantId },
    });
    if (!campaign) {
      throw new NotFoundException("Campaign not found");
    }
    return campaign;
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(tenantId, id);
    Object.assign(campaign, dto);
    return this.campaignRepository.save(campaign);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const campaign = await this.findOne(tenantId, id);
    await this.campaignRepository.remove(campaign);
  }

  /**
   * Dispatches a campaign: resolves its audience, then fans out via the unified
   * send path (queued/scheduled). Supported audiences: `topic`, `list`/`subscribers`
   * (`subscriberIds`/`ids`/`addresses`), and `subscriber` (single id). `all` is
   * rejected (unsafe blast). Recurring campaigns are re-scheduled; drip campaigns
   * advance by step; triggered campaigns can be dispatched manually but are not
   * auto-triggered by events here.
   */
  async dispatch(
    tenantId: string,
    id: string,
    options?: CampaignDispatchOptions,
  ): Promise<CampaignDispatchResult> {
    const campaign = await this.findOne(tenantId, id);

    if (!DISPATCHABLE_STATUSES.has(campaign.status)) {
      throw new BadRequestException(`Campaign in status '${campaign.status}' cannot be dispatched`);
    }

    const channels = (campaign.channels ?? []).filter((ch): ch is NotificationChannel =>
      DELIVERABLE_CHANNELS.has(ch),
    );
    if (channels.length === 0) {
      throw new BadRequestException("Campaign must have at least one valid channel");
    }

    const subscriberIds = options?.subscriberIds?.length
      ? [
          ...new Set(
            options.subscriberIds
              .filter((s) => typeof s === "string" && s.trim())
              .map((s) => s.trim()),
          ),
        ]
      : await this.resolveAudience(tenantId, campaign.audience ?? {}, options);
    if (subscriberIds.length === 0) {
      throw new BadRequestException("Campaign audience resolved to no subscribers");
    }

    const step = this.currentDripStep(campaign);
    const message = this.resolveMessage(campaign, step);
    if (!message.templateId && !message.data) {
      throw new BadRequestException(
        "Campaign needs a templateId or data (set templates[0].templateId or templates[0].data)",
      );
    }

    const scheduledAt = this.resolveScheduledAt(campaign.schedule ?? {});
    const payload = (subscriberId: string): SendUnifiedDto => ({
      to: subscriberId,
      channels,
      templateId: message.templateId,
      subject: message.subject,
      data: message.data,
      variables: {
        ...(message.variables ?? {}),
        ...(options?.variables ?? {}),
        campaignId: campaign.id,
        campaignName: campaign.name,
        ...(options?.trigger ? { trigger: options.trigger } : {}),
        ...(campaign.type === "drip" ? { dripStep: step } : {}),
      },
      metadata: { campaignId: campaign.id, source: "campaign", step, trigger: options?.trigger },
      ...(scheduledAt ? { scheduledAt: scheduledAt.toISOString() } : {}),
    });

    campaign.status = scheduledAt ? "scheduled" : "active";
    if (!scheduledAt) {
      campaign.nextRunAt = null;
      if ((campaign.schedule as any)?.nextRunAt) {
        const schedule = { ...(campaign.schedule ?? {}) } as Record<string, unknown>;
        delete schedule.nextRunAt;
        campaign.schedule = schedule;
      }
    } else {
      campaign.nextRunAt = scheduledAt;
    }
    await this.campaignRepository.save(campaign);

    const CHUNK = 50;
    let queued = 0;
    let failed = 0;
    for (let i = 0; i < subscriberIds.length; i += CHUNK) {
      const chunk = subscriberIds.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map((subscriberId) => this.unifiedSendService.send(payload(subscriberId), tenantId)),
      );
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.status !== "failed") {
          queued++;
        } else {
          failed++;
          if (result.status === "rejected") {
            this.logger.warn(
              `Campaign ${id} send failed: ${result.reason?.message ?? result.reason}`,
            );
          }
        }
      }
    }

    const followUp = this.resolveFollowUp(campaign, step, scheduledAt);
    Object.assign(
      campaign,
      this.withExecutionCursor(campaign, followUp, queued, failed, subscriberIds.length, step),
    );
    await this.campaignRepository.save(campaign);

    this.logger.log(
      `Dispatched campaign ${id} to ${subscriberIds.length} subscribers (queued=${queued} failed=${failed} status=${campaign.status})`,
    );
    return {
      campaignId: campaign.id,
      status: campaign.status,
      targeted: subscriberIds.length,
      queued,
      failed,
      scheduledAt: scheduledAt?.toISOString(),
      nextRunAt: followUp.schedulePatch.nextRunAt as string | undefined,
      step: campaign.type === "drip" ? step : undefined,
      trigger: options?.trigger,
    };
  }

  /**
   * Event-driven dispatch for triggered campaigns. Emit `campaign.trigger` with
   * `{ tenantId, event|trigger, subscriberId|subscriberIds|to, data?, campaignId? }`.
   */
  @OnEvent("campaign.trigger")
  async onCampaignTrigger(payload: Record<string, any>): Promise<void> {
    const tenantId = typeof payload?.tenantId === "string" ? payload.tenantId : "";
    const eventName = String(payload?.event ?? payload?.trigger ?? "").trim();
    if (!tenantId) return;

    const campaigns = await this.campaignRepository.find({
      where: { tenantId, type: "triggered", status: "active" as any },
    });

    for (const campaign of campaigns) {
      if (payload?.campaignId && payload.campaignId !== campaign.id) continue;
      const configured = String(
        (campaign.schedule as any)?.trigger ??
          (campaign.schedule as any)?.event ??
          ((campaign as any).metadata as any)?.triggerEvent ??
          "",
      ).trim();
      if (configured && eventName && configured !== eventName) continue;
      if (!configured && !payload?.campaignId) continue; // avoid firing unscoped triggered campaigns

      const overrideIds = this.extractSubscriberIds(payload);
      try {
        await this.dispatch(tenantId, campaign.id, {
          subscriberIds: overrideIds.length ? overrideIds : undefined,
          variables:
            payload?.data && typeof payload.data === "object"
              ? payload.data
              : { triggerPayload: payload },
          trigger: eventName || configured || "campaign.trigger",
        });
      } catch (error) {
        this.logger.warn(`Triggered campaign ${campaign.id} failed: ${(error as Error).message}`);
      }
    }
  }

  private extractSubscriberIds(payload: Record<string, any>): string[] {
    const ids: string[] = [];
    if (typeof payload?.subscriberId === "string") ids.push(payload.subscriberId);
    if (typeof payload?.to === "string") ids.push(payload.to);
    if (Array.isArray(payload?.subscriberIds))
      ids.push(...payload.subscriberIds.filter((v: any) => typeof v === "string"));
    return [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
  }

  /**
   * Periodic tick: dispatches recurring/drip campaigns whose `schedule.nextRunAt`
   * is due. Triggered campaigns are event-driven and are not auto-dispatched here.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueCampaigns(): Promise<void> {
    const now = new Date();
    const candidates = await this.campaignRepository.find({
      where: [
        { type: "recurring", status: "active" },
        { type: "recurring", status: "scheduled" },
        { type: "drip", status: "active" },
        { type: "drip", status: "scheduled" },
      ],
    });

    for (const campaign of candidates) {
      const nextRunAt = this.getNextRunAt(campaign);
      if (!nextRunAt || nextRunAt.getTime() > now.getTime()) {
        continue;
      }
      try {
        await this.dispatch(campaign.tenantId, campaign.id);
      } catch (error) {
        this.logger.warn(
          `Due campaign ${campaign.id} dispatch failed: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Audience resolution seam: (tenant, audience spec, trigger context) -> subscriber identities.
   * New audience kinds (e.g. segment/filter) add a handler without changing dispatch/fan-out.
   */
  private async resolveAudience(
    tenantId: string,
    audience: Record<string, unknown>,
    options?: CampaignDispatchOptions,
  ): Promise<string[]> {
    const type = String(audience.type ?? "").toLowerCase();
    const handler = this.audienceResolvers[type];
    if (!handler) {
      throw new BadRequestException(
        "Unsupported audience.type; use 'topic', 'topics', 'list', 'subscriber', or 'trigger'",
      );
    }
    return handler(tenantId, audience, options);
  }

  private readonly audienceResolvers: Record<
    string,
    (
      tenantId: string,
      audience: Record<string, unknown>,
      options?: CampaignDispatchOptions,
    ) => Promise<string[]>
  > = {
    topic: async (tenantId, audience) => {
      const topic = String(audience.topic ?? "").trim();
      if (!topic) {
        throw new BadRequestException("audience.topic is required when audience.type is 'topic'");
      }
      const subscribers = await this.topicsService.listSubscribers(tenantId, topic);
      return subscribers.map((s) => String(s).trim()).filter(Boolean);
    },
    topics: async (tenantId, audience) => {
      const list = Array.isArray(audience.topics) ? audience.topics : [];
      const names = list.map((t) => String(t).trim()).filter(Boolean);
      if (names.length === 0) {
        throw new BadRequestException(
          "audience.topics must be a non-empty array when audience.type is 'topics'",
        );
      }
      const sets = await Promise.all(
        names.map((topic) => this.topicsService.listSubscribers(tenantId, topic)),
      );
      return Array.from(
        new Set(
          sets
            .flat()
            .map((s) => String(s).trim())
            .filter(Boolean),
        ),
      );
    },
    list: async (_tenantId, audience) => this.resolveExplicitAudience(audience),
    subscribers: async (_tenantId, audience) => this.resolveExplicitAudience(audience),
    subscriber: async (_tenantId, audience) => {
      const id = String(audience.subscriberId ?? audience.id ?? audience.to ?? "").trim();
      if (!id) {
        throw new BadRequestException(
          "audience.subscriberId is required when audience.type is 'subscriber'",
        );
      }
      return [id];
    },
    single: async (_tenantId, audience) => {
      const id = String(audience.subscriberId ?? audience.id ?? audience.to ?? "").trim();
      if (!id) {
        throw new BadRequestException(
          "audience.subscriberId is required when audience.type is 'subscriber'",
        );
      }
      return [id];
    },
    trigger: async (_tenantId, _audience, options) => this.resolveTriggerAudience(options),
    event: async (_tenantId, _audience, options) => this.resolveTriggerAudience(options),
    all: async () => {
      throw new BadRequestException(
        "audience.type 'all' is not supported for dispatch (unsafe blast); use type 'topic', 'topics', 'list', or 'subscriber'",
      );
    },
  };

  private async resolveExplicitAudience(audience: Record<string, unknown>): Promise<string[]> {
    const ids = Array.isArray(audience.subscriberIds)
      ? audience.subscriberIds
      : Array.isArray(audience.ids)
        ? audience.ids
        : Array.isArray(audience.addresses)
          ? audience.addresses
          : [];
    const resolved = ids.map((s) => String(s).trim()).filter(Boolean);
    if (resolved.length === 0) {
      throw new BadRequestException(
        "audience.subscriberIds must be a non-empty array for list audiences",
      );
    }
    return Array.from(new Set(resolved));
  }

  private async resolveTriggerAudience(options?: CampaignDispatchOptions): Promise<string[]> {
    const ids = options?.subscriberIds ?? [];
    if (ids.length === 0) {
      throw new BadRequestException(
        "Triggered/event audience requires subscriberId(s) at dispatch time",
      );
    }
    return ids;
  }

  private resolveMessage(campaign: Campaign, step = 0): CampaignMessage {
    const templates = Array.isArray(campaign.templates) ? campaign.templates : [];
    const idx = Math.min(Math.max(step, 0), Math.max(templates.length - 1, 0));
    const first = (templates[idx] ?? templates[0] ?? {}) as Record<string, unknown>;
    return {
      templateId: typeof first.templateId === "string" ? first.templateId : undefined,
      subject: typeof first.subject === "string" ? first.subject : undefined,
      data:
        typeof first.data === "string"
          ? first.data
          : typeof (campaign as any).data === "string"
            ? (campaign as any).data
            : undefined,
      variables:
        first.variables && typeof first.variables === "object" && !Array.isArray(first.variables)
          ? (first.variables as Record<string, any>)
          : first.data && typeof first.data === "object" && !Array.isArray(first.data)
            ? (first.data as Record<string, any>)
            : undefined,
    };
  }

  private currentDripStep(campaign: Campaign): number {
    if (campaign.type !== "drip") {
      return 0;
    }
    const columnValue = Number((campaign as any).dripStep ?? 0);
    if (Number.isFinite(columnValue) && columnValue >= 0) {
      return Math.floor(columnValue);
    }
    const n = Number((campaign.analytics as any)?.dripStep ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  private resolveScheduledAt(schedule: Record<string, unknown>): Date | undefined {
    const raw =
      typeof schedule.scheduledAt === "string"
        ? schedule.scheduledAt
        : typeof schedule.sendAt === "string"
          ? schedule.sendAt
          : undefined;
    if (!raw) {
      return undefined;
    }
    const date = new Date(raw);
    return Number.isFinite(date.getTime()) && date.getTime() > Date.now() ? date : undefined;
  }

  private repeatIntervalMs(schedule: Record<string, unknown>): number | undefined {
    const everyMs = Number(schedule.everyMs ?? schedule.intervalMs);
    if (Number.isFinite(everyMs) && everyMs >= 60_000) {
      return Math.floor(everyMs);
    }
    const everyMinutes = Number(schedule.everyMinutes);
    if (Number.isFinite(everyMinutes) && everyMinutes > 0) {
      return Math.floor(everyMinutes * 60_000);
    }
    const everyHours = Number(schedule.everyHours);
    if (Number.isFinite(everyHours) && everyHours > 0) {
      return Math.floor(everyHours * 3_600_000);
    }
    return undefined;
  }

  private getNextRunAt(campaign: Campaign): Date | undefined {
    if (campaign.nextRunAt instanceof Date && Number.isFinite(campaign.nextRunAt.getTime())) {
      return campaign.nextRunAt;
    }
    const raw = (campaign.schedule ?? {}).nextRunAt;
    if (typeof raw !== "string") {
      return undefined;
    }
    const date = new Date(raw);
    return Number.isFinite(date.getTime()) ? date : undefined;
  }

  private withExecutionCursor(
    campaign: Campaign,
    followUp: {
      status: Campaign["status"];
      schedulePatch: Record<string, unknown>;
      nextStep?: number;
    },
    queued: number,
    failed: number,
    targeted: number,
    step: number,
  ): Pick<
    Campaign,
    "status" | "schedule" | "analytics" | "nextRunAt" | "lastDispatchedAt" | "dripStep"
  > {
    const nextSchedule = { ...(campaign.schedule ?? {}), ...followUp.schedulePatch };
    const nextRunAtRaw = nextSchedule.nextRunAt;
    const nextRunAt =
      typeof nextRunAtRaw === "string" && Number.isFinite(new Date(nextRunAtRaw).getTime())
        ? new Date(nextRunAtRaw)
        : null;

    if (followUp.status === "completed") {
      delete (nextSchedule as Record<string, unknown>).nextRunAt;
    }

    const nextAnalytics: Record<string, unknown> = {
      ...(campaign.analytics ?? {}),
      totalSent: Number((campaign.analytics as any)?.totalSent ?? 0) + queued,
      targeted,
      failed,
      lastDispatchedAt: new Date().toISOString(),
      lastUpdated: new Date(),
    };

    const dripStep = campaign.type === "drip" ? (followUp.nextStep ?? step) : 0;
    if (campaign.type === "drip") {
      nextAnalytics.dripStep = dripStep;
    } else {
      delete nextAnalytics.dripStep;
    }

    return {
      status: followUp.status,
      schedule: nextSchedule,
      analytics: nextAnalytics,
      nextRunAt: followUp.status === "completed" ? null : nextRunAt,
      lastDispatchedAt: new Date(),
      dripStep,
    };
  }

  /**
   * Schedule/follow-up policy seam: (campaign, step, scheduledAt) -> next status/schedule/step.
   * New campaign timing strategies (e.g. cron-expression recurring) extend here without changing dispatch.
   */
  private resolveFollowUp(
    campaign: Campaign,
    step: number,
    scheduledAt: Date | undefined,
  ): { status: Campaign["status"]; schedulePatch: Record<string, unknown>; nextStep?: number } {
    if (scheduledAt) {
      return { status: "scheduled", schedulePatch: {} };
    }
    const policy = this.followUpPolicies[campaign.type];
    return policy ? policy(campaign, step) : this.followUpPolicies.one_time(campaign, step);
  }

  private readonly followUpPolicies: Record<
    string,
    (
      campaign: Campaign,
      step: number,
    ) => { status: Campaign["status"]; schedulePatch: Record<string, unknown>; nextStep?: number }
  > = {
    one_time: () => ({ status: "completed", schedulePatch: {} }),
    triggered: () => ({ status: "completed", schedulePatch: {} }),
    recurring: (campaign) => {
      const intervalMs = this.repeatIntervalMs(campaign.schedule ?? {});
      if (intervalMs) {
        const nextRunAt = new Date(Date.now() + intervalMs).toISOString();
        return { status: "active", schedulePatch: { nextRunAt } };
      }
      return { status: "active", schedulePatch: {} };
    },
    drip: (campaign, step) => {
      const templates = Array.isArray(campaign.templates) ? campaign.templates : [];
      const nextStep = step + 1;
      if (nextStep < templates.length) {
        const next = templates[nextStep] as Record<string, unknown>;
        const delayMs = Number(next.delayMs ?? next.afterMs ?? 0);
        const nextRunAt = new Date(
          Date.now() + (Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0),
        ).toISOString();
        return { status: "active", schedulePatch: { nextRunAt }, nextStep };
      }
      return { status: "completed", schedulePatch: {}, nextStep: step };
    },
  };

  private toResponse(campaign: Campaign) {
    return {
      id: campaign.id,
      tenantId: campaign.tenantId,
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      status: campaign.status,
      channels: campaign.channels,
      audience: campaign.audience,
      schedule: {
        ...(campaign.schedule ?? {}),
        ...(campaign.nextRunAt ? { nextRunAt: campaign.nextRunAt.toISOString() } : {}),
      },
      templates: campaign.templates,
      analytics: {
        ...(campaign.analytics ?? {}),
        ...(campaign.lastDispatchedAt
          ? { lastDispatchedAt: campaign.lastDispatchedAt.toISOString() }
          : {}),
        ...(campaign.type === "drip" ? { dripStep: campaign.dripStep ?? 0 } : {}),
      },
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      createdBy: campaign.createdById || "",
    };
  }
}
