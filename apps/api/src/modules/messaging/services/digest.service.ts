import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

export interface DigestConfig {
  frequency: 'instant' | 'daily' | 'weekly' | 'monthly';
  maxNotificationsPerDigest?: number;
  timeWindow?: number; // in minutes
}

export interface DigestNotification {
  id: string;
  subscriberId: string;
  tenantId: string;
  channel: string;
  title: string;
  content: string;
  data?: Record<string, any>;
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

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private digestQueue: Map<string, DigestNotification[]> = new Map();
  private digestConfigs: Map<string, DigestConfig> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default digest configurations
   */
  private initializeDefaultConfigs(): void {
    this.digestConfigs.set('instant', {
      frequency: 'instant',
      maxNotificationsPerDigest: 1,
      timeWindow: 0,
    });

    this.digestConfigs.set('daily', {
      frequency: 'daily',
      maxNotificationsPerDigest: 50,
      timeWindow: 1440, // 24 hours
    });

    this.digestConfigs.set('weekly', {
      frequency: 'weekly',
      maxNotificationsPerDigest: 100,
      timeWindow: 10080, // 7 days
    });

    this.digestConfigs.set('monthly', {
      frequency: 'monthly',
      maxNotificationsPerDigest: 200,
      timeWindow: 43200, // 30 days
    });
  }

  /**
   * Add notification to digest queue
   */
  async queueNotificationForDigest(
    notification: DigestNotification,
    config: DigestConfig,
  ): Promise<void> {
    const queueKey = `${notification.tenantId}:${notification.subscriberId}:${notification.channel}:${config.frequency}`;

    if (!this.digestQueue.has(queueKey)) {
      this.digestQueue.set(queueKey, []);
    }

    const queue = this.digestQueue.get(queueKey)!;
    queue.push(notification);

    this.logger.debug(
      `Queued notification for digest: ${queueKey} (total: ${queue.length})`,
    );

    // Check if we should send immediately (for instant frequency)
    if (config.frequency === 'instant' && queue.length >= (config.maxNotificationsPerDigest || 1)) {
      await this.sendDigest(queueKey);
    }
  }

  /**
   * Get digest configuration for subscriber
   */
  getDigestConfig(frequency: string): DigestConfig | undefined {
    return this.digestConfigs.get(frequency);
  }

  /**
   * Send digest for a queue
   */
  async sendDigest(queueKey: string): Promise<DigestBatch | null> {
    const queue = this.digestQueue.get(queueKey);
    if (!queue || queue.length === 0) {
      return null;
    }

    const [tenantId, subscriberId, channel, frequency] = queueKey.split(':');
    const config = this.digestConfigs.get(frequency);

    if (!config) {
      this.logger.warn(`No digest config found for frequency: ${frequency}`);
      return null;
    }

    // Limit notifications in digest
    const maxNotifications = config.maxNotificationsPerDigest || 50;
    const notificationsToSend = queue.splice(0, maxNotifications);

    const digest: DigestBatch = {
      id: `digest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    // Clean up empty queue
    if (queue.length === 0) {
      this.digestQueue.delete(queueKey);
    }

    return digest;
  }

  /**
   * Process daily digests (runs at 9 AM)
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processDailyDigests(): Promise<void> {
    this.logger.log('Processing daily digests...');
    await this.processDigestsByFrequency('daily');
  }

  /**
   * Process weekly digests (runs every Monday at 9 AM)
   */
  @Cron('0 9 * * 1')
  async processWeeklyDigests(): Promise<void> {
    this.logger.log('Processing weekly digests...');
    await this.processDigestsByFrequency('weekly');
  }

  /**
   * Process monthly digests (runs on 1st of month at 9 AM)
   */
  @Cron('0 9 1 * *')
  async processMonthlyDigests(): Promise<void> {
    this.logger.log('Processing monthly digests...');
    await this.processDigestsByFrequency('monthly');
  }

  /**
   * Process digests by frequency
   */
  private async processDigestsByFrequency(frequency: string): Promise<void> {
    const keysToProcess: string[] = [];

    // Find all queues matching this frequency
    for (const [key] of this.digestQueue) {
      if (key.endsWith(`:${frequency}`)) {
        keysToProcess.push(key);
      }
    }

    this.logger.log(`Found ${keysToProcess.length} ${frequency} digests to process`);

    for (const key of keysToProcess) {
      try {
        await this.sendDigest(key);
      } catch (error) {
        this.logger.error(`Failed to send digest for ${key}:`, error);
      }
    }
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    totalQueues: number;
    totalNotifications: number;
    queuesByFrequency: Record<string, number>;
  } {
    let totalNotifications = 0;
    const queuesByFrequency: Record<string, number> = {};

    for (const [key, notifications] of this.digestQueue) {
      const frequency = key.split(':')[3];
      totalNotifications += notifications.length;
      queuesByFrequency[frequency] = (queuesByFrequency[frequency] || 0) + notifications.length;
    }

    return {
      totalQueues: this.digestQueue.size,
      totalNotifications,
      queuesByFrequency,
    };
  }

  /**
   * Clear digest queue for a subscriber
   */
  async clearSubscriberDigests(subscriberId: string, tenantId: string): Promise<void> {
    const keysToDelete: string[] = [];

    for (const key of this.digestQueue.keys()) {
      if (key.includes(`${tenantId}:${subscriberId}`)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.digestQueue.delete(key);
    }

    this.logger.log(`Cleared ${keysToDelete.length} digest queues for subscriber ${subscriberId}`);
  }

  /**
   * Aggregate similar notifications in digest
   */
  aggregateNotifications(notifications: DigestNotification[]): DigestNotification[] {
    const aggregated: Map<string, DigestNotification> = new Map();

    for (const notification of notifications) {
      const key = `${notification.templateId || notification.title}`;
      
      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        // Increment count in data
        if (!existing.data) existing.data = {};
        existing.data.count = (existing.data.count || 1) + 1;
      } else {
        aggregated.set(key, { ...notification });
      }
    }

    return Array.from(aggregated.values());
  }

  /**
   * Get pending digests for a subscriber
   */
  getPendingDigests(subscriberId: string, tenantId: string): DigestNotification[] {
    const pending: DigestNotification[] = [];

    for (const [key, notifications] of this.digestQueue) {
      if (key.includes(`${tenantId}:${subscriberId}`)) {
        pending.push(...notifications);
      }
    }

    return pending;
  }
}
