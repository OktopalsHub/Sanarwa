import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessLogicException } from "../../../common/errors/exceptions/base.exception";
import { ErrorCode } from "../../../common/errors/types/error.types";
import { randomUUID } from "node:crypto";
import { IdempotencyKey } from "./idempotency-key.entity";

const TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyClaim =
  | { kind: "claimed" }
  | { kind: "done"; row: IdempotencyKey }
  | { kind: "inflight" };

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repository: Repository<IdempotencyKey>,
  ) {}

  async claim(tenantId: string, key: string): Promise<IdempotencyClaim> {
    if (!key) {
      return { kind: "claimed" };
    }

    const expiresAt = new Date(Date.now() + TTL_MS);

    try {
      await this.repository.insert({
        tenantId,
        key,
        status: "pending",
        expiresAt,
      });
      return { kind: "claimed" };
    } catch (error) {
      if ((error as any)?.driverError?.code !== "23505") {
        throw error;
      }
    }

    const row = await this.repository.findOne({ where: { tenantId, key } });

    if (!row || row.expiresAt.getTime() <= Date.now()) {
      throw new BusinessLogicException(
        ErrorCode.INVALID_OPERATION,
        "Could not claim idempotency key",
        { correlationId: randomUUID(), tenantId, timestamp: new Date(), metadata: { key } },
        "Could not claim idempotency key",
        false,
      );
    }

    return row.status === "complete" ? { kind: "done", row } : { kind: "inflight" };
  }

  async complete(
    tenantId: string,
    key: string,
    messageId: string,
    response: Record<string, any>,
  ): Promise<void> {
    await this.repository.update(
      { tenantId, key },
      {
        status: "complete",
        messageId,
        response,
      },
    );
  }

  async abandon(tenantId: string, key: string): Promise<void> {
    await this.repository.delete({ tenantId, key, status: "pending" });
  }
}
