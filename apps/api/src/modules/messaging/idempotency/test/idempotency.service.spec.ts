import { describe, expect, it, vi, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { IdempotencyService } from "../idempotency.service";
import { IdempotencyKey } from "../idempotency-key.entity";

const TENANT = "tenant-1";

function makeRepo() {
  const store: IdempotencyKey[] = [];
  let record = (overrides: Partial<IdempotencyKey> = {}): IdempotencyKey =>
    ({
      id: "id-1",
      tenantId: TENANT,
      key: "key-1",
      status: "pending",
      messageId: null,
      response: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      ...overrides,
    }) as IdempotencyKey;

  return {
    insert: vi.fn().mockImplementation(async (row) => {
      if (store.find((item) => item.tenantId === row.tenantId && item.key === row.key)) {
        const error = new Error("duplicate") as any;
        error.driverError = { code: "23505" };
        throw error;
      }
      store.push(record(row));
      return { identifiers: [{ id: "id-1" }] };
    }),
    findOne: vi.fn().mockImplementation(async ({ where }) => {
      return (
        store.find((item) => item.tenantId === where.tenantId && item.key === where.key) ?? null
      );
    }),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
  };
}

describe("IdempotencyService", () => {
  let service: IdempotencyService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: getRepositoryToken(IdempotencyKey), useValue: repo },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  it("claims an unused key", async () => {
    const claim = await service.claim(TENANT, "key-1");
    expect(claim).toEqual({ kind: "claimed" });
  });

  it("replays the response for an already completed key", async () => {
    storeClaim(repo, {
      status: "complete",
      messageId: "msg-1",
      response: { messageId: "msg-1", status: "queued", deliveries: [] },
    });
    const claim = await service.claim(TENANT, "key-1");
    expect(claim.kind).toBe("done");
  });

  it("reports inflight for a pending key that hasn't expired", async () => {
    storeClaim(repo, { status: "pending" });

    const claim = await service.claim(TENANT, "key-1");
    expect(claim.kind).toBe("inflight");
  });

  it("completes a claimed key", async () => {
    await service.claim(TENANT, "key-1");
    await service.complete(TENANT, "key-1", "msg-1", { ok: true } as any);

    expect(repo.update).toHaveBeenCalledWith(
      { tenantId: TENANT, key: "key-1" },
      expect.objectContaining({ status: "complete", messageId: "msg-1" }),
    );
  });

  it("abandons only pending claims", async () => {
    await service.abandon(TENANT, "key-1");
    expect(repo.delete).toHaveBeenCalledWith({
      tenantId: TENANT,
      key: "key-1",
      status: "pending",
    });
  });
});

function storeClaim(repo: ReturnType<typeof makeRepo>, overrides: Partial<IdempotencyKey>): void {
  const originalInsert = repo.insert;

  repo.insert = vi.fn().mockImplementation(async () => {
    const error = new Error("duplicate") as any;
    error.driverError = { code: "23505" };
    throw error;
  });

  const row: IdempotencyKey = {
    id: "id-1",
    tenantId: TENANT,
    key: "key-1",
    status: "pending",
    messageId: null,
    response: null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  } as IdempotencyKey;

  repo.findOne = vi.fn().mockResolvedValue(row);
}
