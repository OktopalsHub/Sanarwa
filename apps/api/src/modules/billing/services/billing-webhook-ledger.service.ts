import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { WebhookEvent, WebhookEventStatus } from "../entities/webhook-event.entity";

const PROCESSING_STALE_MS = 5 * 60 * 1000;

@Injectable()
export class BillingWebhookLedgerService {
  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async claim(provider: string, eventId: string, payloadHash: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(WebhookEvent);
      const existing = await repo.findOne({
        where: { provider, eventId },
        lock: { mode: "pessimistic_write" },
      });

      if (!existing) {
        const record = repo.create({
          provider,
          eventId,
          payloadHash,
          status: "processing",
          errorMessage: null,
          attemptCount: 1,
          lastAttemptAt: new Date(),
        });
        await repo.save(record);
        return true;
      }

      if (existing.status === "processed") {
        return false;
      }

      if (existing.status === "processing") {
        const age = Date.now() - new Date(existing.lastAttemptAt).getTime();
        if (age < PROCESSING_STALE_MS) {
          return false;
        }
      }

      existing.status = "processing";
      existing.payloadHash = payloadHash;
      existing.errorMessage = null;
      existing.attemptCount = (existing.attemptCount ?? 0) + 1;
      existing.lastAttemptAt = new Date();
      await repo.save(existing);
      return true;
    });
  }

  async mark(
    provider: string,
    eventId: string,
    status: WebhookEventStatus,
    errorMessage: string | null,
  ): Promise<void> {
    await this.webhookEventRepository.update(
      { provider, eventId },
      {
        status,
        errorMessage,
        lastAttemptAt: new Date(),
      },
    );
  }
}
