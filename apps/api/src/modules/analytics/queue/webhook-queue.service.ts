import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { WEBHOOK_RETRY_QUEUE } from './webhook-queue.constants';

export interface WebhookRetryJob {
  tenantId: string;
  webhookUrl: string;
  payload: any;
  secret?: string;
  headers?: Record<string, string>;
  timeout?: number;
  idempotencyKey: string;
  attempt: number;
  maxRetries: number;
}

@Injectable()
export class WebhookQueueService {
  private readonly logger = new Logger(WebhookQueueService.name);

  constructor(
    @InjectQueue(WEBHOOK_RETRY_QUEUE)
    private readonly webhookRetryQueue: Queue<WebhookRetryJob>,
  ) {}

  /**
   * Queue a webhook for retry
   */
  async queueWebhookRetry(job: WebhookRetryJob): Promise<void> {
    try {
      await this.webhookRetryQueue.add(job, {
        jobId: `${job.idempotencyKey}-attempt-${job.attempt}`,
        priority: 10 - job.attempt, // Higher priority for earlier attempts
        delay: this.calculateBackoffDelay(job.attempt),
      });

      this.logger.log(
        `Queued webhook retry for ${job.webhookUrl} (attempt ${job.attempt}/${job.maxRetries})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue webhook retry: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate exponential backoff delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: 2^attempt seconds, capped at 5 minutes
    const delaySeconds = Math.min(Math.pow(2, attempt - 1), 300);
    return delaySeconds * 1000;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    active: number;
    waiting: number;
    delayed: number;
    failed: number;
    completed: number;
  }> {
    const counts = await this.webhookRetryQueue.getJobCounts();
    return {
      active: counts.active,
      waiting: counts.waiting,
      delayed: counts.delayed,
      failed: counts.failed,
      completed: counts.completed,
    };
  }

  /**
   * Clear failed jobs
   */
  async clearFailedJobs(): Promise<void> {
    const failedJobs = await this.webhookRetryQueue.getFailed();
    for (const job of failedJobs) {
      await job.remove();
    }
    this.logger.log(`Cleared ${failedJobs.length} failed webhook jobs`);
  }

  /**
   * Retry a specific failed job
   */
  async retryFailedJob(jobId: string): Promise<void> {
    const job = await this.webhookRetryQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    this.logger.log(`Retried webhook job ${jobId}`);
  }
}
