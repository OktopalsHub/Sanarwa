import { Process, Processor } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { Job } from "bull";
import axios, { AxiosResponse } from "axios";
import { WEBHOOK_RETRY_QUEUE } from "./webhook-queue.constants";
import { WebhookRetryJob } from "./webhook-queue.service";
import * as crypto from "crypto";

@Processor(WEBHOOK_RETRY_QUEUE)
export class WebhookRetryProcessor {
  private readonly logger = new Logger(WebhookRetryProcessor.name);

  @Process()
  async handleWebhookRetry(job: Job<WebhookRetryJob>): Promise<void> {
    const {
      tenantId,
      webhookUrl,
      payload,
      secret,
      headers,
      timeout,
      idempotencyKey,
      attempt,
      maxRetries,
    } = job.data;

    try {
      this.logger.log(
        `Processing webhook retry for ${webhookUrl} (attempt ${attempt}/${maxRetries})`,
      );

      const webhookHeaders = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": this.generateSignature(payload, secret),
        "X-Idempotency-Key": idempotencyKey,
        "X-Attempt": attempt.toString(),
        "X-Tenant-Id": tenantId,
        ...headers,
      };

      const response: AxiosResponse = await axios.post(webhookUrl, payload, {
        headers: webhookHeaders,
        timeout: Math.max(0, timeout || 10000),
        validateStatus: (status) => status >= 200 && status < 300,
      });

      this.logger.log(
        `Webhook delivered successfully to ${webhookUrl} (attempt ${attempt}): ${response.status}`,
      );

      // Mark job as completed
      job.progress(100);
    } catch (error) {
      const statusCode = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message;

      this.logger.warn(
        `Webhook attempt ${attempt}/${maxRetries} failed for ${webhookUrl}: ${statusCode} ${errorMessage}`,
      );

      // If this is the last attempt, throw error to mark job as failed
      if (attempt >= maxRetries) {
        this.logger.error(
          `Webhook failed after ${maxRetries} attempts for ${webhookUrl}: ${errorMessage}`,
        );
        throw new Error(`Webhook delivery failed after ${maxRetries} attempts: ${errorMessage}`, {
          cause: error,
        });
      }

      // For non-final attempts, throw to trigger retry with backoff
      throw error;
    }
  }

  /**
   * Generate HMAC signature for webhook security
   */
  private generateSignature(payload: any, secret?: string): string {
    if (!secret) {
      return "";
    }

    const payloadString = JSON.stringify(payload);
    return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
  }
}
