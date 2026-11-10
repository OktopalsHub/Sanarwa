import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, IsNull, Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { getPaginationSummary } from "../../common/dto/pagination.dto";
import { IPaginatedData } from "../../common/interfaces";
import { NotificationPreference } from "./entities/notification-preference.entity";
import { NotificationSuppression } from "./entities/notification-suppression.entity";
import { SubscriberQuietHours } from "./entities/subscriber-quiet-hours.entity";
import { SubscriberErasureService, SubscriberEraseResult } from "./subscriber-erasure.service";

const ALL_CHANNELS = Object.values(NotificationChannel);

export type { SubscriberEraseResult };

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(NotificationSuppression)
    private readonly suppressions: Repository<NotificationSuppression>,
    @InjectRepository(SubscriberQuietHours)
    private readonly quietHours: Repository<SubscriberQuietHours>,
    private readonly erasure: SubscriberErasureService,
  ) {}

  async getSubscriberPreferences(tenantId: string, subscriberId: string) {
    const rows = await this.preferences.find({ where: { tenantId, subscriberId } });

    const map = Object.fromEntries(ALL_CHANNELS.map((channel) => [channel, true]));
    for (const row of rows) {
      map[row.channel] = row.enabled;
    }

    const quietHours = await this.quietHours.findOne({ where: { tenantId, subscriberId } });

    return { subscriberId, preferences: map, quietHours: quietHours ?? null };
  }

  async setChannelEnabled(
    tenantId: string,
    subscriberId: string,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const existing = await this.preferences.findOne({
      where: { tenantId, subscriberId, channel },
    });

    if (existing) {
      existing.enabled = enabled;
      return this.preferences.save(existing);
    }

    return this.preferences.save(
      this.preferences.create({ tenantId, subscriberId, channel, enabled }),
    );
  }

  async getQuietHours(tenantId: string, subscriberId: string) {
    return (await this.quietHours.findOne({ where: { tenantId, subscriberId } })) ?? null;
  }

  async setQuietHours(
    tenantId: string,
    subscriberId: string,
    input: { enabled: boolean; timezone: string; startMinute: number; endMinute: number },
  ): Promise<SubscriberQuietHours> {
    assertValidTimezone(input.timezone);

    const existing = await this.quietHours.findOne({ where: { tenantId, subscriberId } });

    if (existing) {
      existing.enabled = input.enabled;
      existing.timezone = input.timezone;
      existing.startMinute = input.startMinute;
      existing.endMinute = input.endMinute;
      return this.quietHours.save(existing);
    }

    return this.quietHours.save(this.quietHours.create({ tenantId, subscriberId, ...input }));
  }

  async deleteQuietHours(tenantId: string, subscriberId: string): Promise<void> {
    const result = await this.quietHours.delete({ tenantId, subscriberId });
    if (!result.affected) {
      throw new NotFoundException("No quiet hours configured for this subscriber");
    }
  }

  async listSuppressions(
    tenantId: string,
    query: { search?: string; channel?: NotificationChannel; page?: number; limit?: number },
  ): Promise<IPaginatedData<NotificationSuppression>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Record<string, unknown> = { tenantId };
    if (query.channel !== undefined) {
      where.channel = query.channel;
    }
    if (query.search?.trim()) {
      where.address = ILike(`%${query.search.trim().toLowerCase()}%`);
    }

    const [data, total] = await this.suppressions.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return await getPaginationSummary(data, total, { page, limit }, "suppressions");
  }

  async addSuppression(
    tenantId: string,
    input: { address: string; channel?: NotificationChannel; reason: string },
  ): Promise<NotificationSuppression> {
    const address = input.address.trim().toLowerCase();
    const where = input.channel
      ? { tenantId, address, channel: input.channel }
      : { tenantId, address, channel: IsNull() };

    const existing = await this.suppressions.findOne({ where });
    if (existing) {
      existing.reason = input.reason;
      return this.suppressions.save(existing);
    }

    try {
      this.logger.log(
        `Suppressed ${address} for tenant ${tenantId} (${input.channel ?? "all channels"})`,
      );
      return await this.suppressions.save(
        this.suppressions.create({
          tenantId,
          address,
          channel: input.channel,
          reason: input.reason,
        }),
      );
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const conflicted = await this.suppressions.findOne({ where });
      if (!conflicted) throw error;
      conflicted.reason = input.reason;
      return this.suppressions.save(conflicted);
    }
  }

  async removeSuppression(tenantId: string, id: string): Promise<void> {
    const result = await this.suppressions.delete({ id, tenantId });
    if (!result.affected) {
      throw new NotFoundException(`Suppression ${id} not found`);
    }
  }

  /**
   * GDPR/right-to-erasure across subscriber-scoped stores. Delegates to the deep
   * SubscriberErasure module (single seam) which owns per-store delete/redact behavior.
   * Inbox rows are erased via NotificationCenterService endpoint (separate inbox seam).
   */
  async eraseSubscriberData(
    tenantId: string,
    subscriberId: string,
  ): Promise<SubscriberEraseResult> {
    return this.erasure.erase(tenantId, subscriberId);
  }
}

function assertValidTimezone(timezone: string): void {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new BadRequestException(`Unknown IANA timezone: ${timezone}`);
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; driverError?: { code?: string } };
  return e.code === "23505" || e.driverError?.code === "23505";
}
