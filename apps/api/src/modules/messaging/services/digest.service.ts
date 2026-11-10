import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type Redis from "ioredis";
import * as crypto from "crypto";

export interface DigestConfig {
  frequency: "instant" | "daily" | "weekly" | "monthly";
  maxNotificationsPerDigest?: number;
  timeWindow?: number;
}

export interface DigestNotification {
  id: string;
  subscriberId: string;
  tenantId: string;
  channel: string;
  title: string;
  data: string;
  variables?: Record<string, any>;
  createdAt: Date;
  templateId?: string;
}

export interface DigestBatch {
  id: string;
  subscriberId: string;
  tenantId: string;
  channel: string;
  frequency: string;
  notifications: DigestNotification[];
  createdAt: Date;
  scheduledFor: Date;
  sentAt?: Date;
}

const REGISTRY_KEY = "digest:queues";
const queueKey = (key: string) => `digest:q:${key}`;
const lockKey = (key: string) => `digest:lock:${key}`;

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private digestConfigs: Map<string, DigestConfig> = new Map();

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs(): void {
    this.digestConfigs.set("instant", {
      frequency: "instant",
      maxNotificationsPerDigest: 1,
      timeWindow: 0,
    });

    this.digestConfigs.set("daily", {
      frequency: "daily",
      maxNotificationsPerDigest: 50,
      timeWindow: 1440,
    });

    this.digestConfigs.set("weekly", {
      frequency: "weekly",
      maxNotificationsPerDigest: 100,
      timeWindow: 10080,
    });

    this.digestConfigs.set("monthly", {
      frequency: "monthly",
      maxNotificationsPerDigest: 200,
      timeWindow: 43200,
    });
  }

  async queueNotificationForDigest(
    notification: DigestNotification,
    config: DigestConfig,
  ): Promise<void> {
    const queueKeyName = `${notification.tenantId}:${notification.subscriberId}:${notification.channel}:${config.frequency}`;

    const count = await this.redis.rpush(queueKey(queueKeyName), JSON.stringify(notification));
    await this.redis.sadd(REGISTRY_KEY, queueKeyName);

    this.logger.debug(`Queued notification for digest: ${queueKeyName} (total: ${count})`);

    if (config.frequency === "instant" && count >= (config.maxNotificationsPerDigest || 1)) {
      await this.sendDigest(queueKeyName);
    }
  }

  getDigestConfig(frequency: string): DigestConfig | undefined {
    return this.digestConfigs.get(frequency);
  }

  async sendDigest(queueKeyName: string): Promise<DigestBatch | null> {
    const key = queueKey(queueKeyName);
    const [tenantId, subscriberId, channel, frequency] = queueKeyName.split(":");
    const config = this.digestConfigs.get(frequency);

    if (!config) {
      this.logger.warn(`No digest config found for frequency: ${frequency}`);
      return null;
    }

    const maxNotifications = config.maxNotificationsPerDigest || 50;
    const raw = await this.redis.lpop(key, maxNotifications);
    const notificationsToSend = this.parseNotifications(raw);

    if (notificationsToSend.length === 0) {
      await this.redis.srem(REGISTRY_KEY, queueKeyName);
      return null;
    }

    const digest: DigestBatch = {
      id: `digest_${Date.now()}_${crypto.randomBytes(9).toString("base64url")}`,
      subscriberId,
      tenantId,
      channel,
      frequency,
      notifications: notificationsToSend,
      createdAt: new Date(),
      scheduledFor: new Date(),
    };

    this.logger.log(
      `Sending digest for ${subscriberId} on ${channel}: ${notificationsToSend.length} notifications`,
    );

    const remaining = await this.redis.llen(key);
    if (remaining === 0) {
      await this.redis.srem(REGISTRY_KEY, queueKeyName);
    }

    return digest;
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processDailyDigests(): Promise<void> {
    this.logger.log("Processing daily digests...");
    await this.processDigestsByFrequency("daily");
  }

  @Cron("0 9 * * 1")
  async processWeeklyDigests(): Promise<void> {
    this.logger.log("Processing weekly digests...");
    await this.processDigestsByFrequency("weekly");
  }

  @Cron("0 9 1 * *")
  async processMonthlyDigests(): Promise<void> {
    this.logger.log("Processing monthly digests...");
    await this.processDigestsByFrequency("monthly");
  }

  private async processDigestsByFrequency(frequency: string): Promise<void> {
    const keysToProcess = (await this.redis.smembers(REGISTRY_KEY)).filter((key) =>
      key.endsWith(`:${frequency}`),
    );

    this.logger.log(`Found ${keysToProcess.length} ${frequency} digests to process`);

    for (const key of keysToProcess) {
      const token = crypto.randomBytes(16).toString("hex");
      const acquired = await this.redis.set(lockKey(key), token, "PX", 60000, "NX");
      if (acquired !== "OK") {
        this.logger.debug(`Digest ${key} is being processed on another instance, skipping`);
        continue;
      }

      try {
        await this.sendDigest(key);
      } catch (error) {
        this.logger.error(`Failed to send digest for ${key}:`, error);
      } finally {
        const held = await this.redis.get(lockKey(key));
        if (held === token) {
          await this.redis.del(lockKey(key));
        }
      }
    }
  }

  async getQueueStats(): Promise<{
    totalQueues: number;
    totalNotifications: number;
    queuesByFrequency: Record<string, number>;
  }> {
    const queueKeys = await this.redis.smembers(REGISTRY_KEY);
    let totalNotifications = 0;
    const queuesByFrequency: Record<string, number> = {};

    for (const key of queueKeys) {
      const count = await this.redis.llen(queueKey(key));
      const frequency = key.split(":")[3];
      totalNotifications += count;
      queuesByFrequency[frequency] = (queuesByFrequency[frequency] || 0) + count;
    }

    return {
      totalQueues: queueKeys.length,
      totalNotifications,
      queuesByFrequency,
    };
  }

  async clearSubscriberDigests(subscriberId: string, tenantId: string): Promise<void> {
    const queueKeys = await this.redis.smembers(REGISTRY_KEY);
    const keysToDelete = queueKeys.filter((key) => key.includes(`${tenantId}:${subscriberId}`));

    if (keysToDelete.length > 0) {
      await this.redis.del(keysToDelete.map((key) => queueKey(key)));
      await this.redis.srem(REGISTRY_KEY, ...keysToDelete);
    }

    this.logger.log(`Cleared ${keysToDelete.length} digest queues for subscriber ${subscriberId}`);
  }

  aggregateNotifications(notifications: DigestNotification[]): DigestNotification[] {
    const aggregated: Map<string, DigestNotification> = new Map();

    for (const notification of notifications) {
      const key = `${notification.templateId || notification.title}`;

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        if (!existing.variables) existing.variables = {};
        existing.variables.count = (existing.variables.count || 1) + 1;
      } else {
        aggregated.set(key, { ...notification });
      }
    }

    return Array.from(aggregated.values());
  }

  async getPendingDigests(subscriberId: string, tenantId: string): Promise<DigestNotification[]> {
    const queueKeys = await this.redis.smembers(REGISTRY_KEY);
    const keys = queueKeys.filter((key) => key.includes(`${tenantId}:${subscriberId}`));

    if (keys.length === 0) {
      return [];
    }

    const pending: DigestNotification[] = [];
    for (const key of keys) {
      const raw = await this.redis.lrange(queueKey(key), 0, -1);
      pending.push(...this.parseNotifications(raw));
    }

    return pending;
  }

  private parseNotifications(raw: string[] | null): DigestNotification[] {
    if (!raw) {
      return [];
    }

    return raw.map((item) => {
      const notification = JSON.parse(item) as DigestNotification;
      notification.createdAt = new Date(notification.createdAt);
      return notification;
    });
  }
}
