import { describe, expect, it, vi } from "vitest";
import { DataSource } from "typeorm";
import { TokenManagementService } from "../services/token-management.service";
import { TokenBalance, TokenTransaction } from "../../billing/entities/token-balance.entity";

function setup(existingUsage: TokenTransaction | null) {
  const balance = {
    totalTokens: 100,
    usedTokens: 10,
    availableTokens: 90,
    reservedTokens: 0,
  } as TokenBalance;
  const manager = {
    findOne: vi.fn(async (entity: unknown) => (entity === TokenBalance ? balance : existingUsage)),
    save: vi.fn(),
    create: vi.fn((_entity: unknown, value: unknown) => value),
  };
  const queryRunner = {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
    manager,
  };
  const dataSource = { createQueryRunner: () => queryRunner } as unknown as DataSource;
  const service = new TokenManagementService({} as never, {} as never, dataSource);
  return { service, manager, queryRunner };
}

const usage = { tenantId: "t1", amount: 3, referenceId: "voice:cc-1" };

describe("TokenManagementService.useTokens dedupeByReference", () => {
  it("does not charge a reference that was already charged", async () => {
    const { service, manager, queryRunner } = setup({ id: "tx-1" } as TokenTransaction);

    const info = await service.useTokens({ ...usage, dedupeByReference: true });

    expect(manager.save).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledOnce();
    expect(info.availableTokens).toBe(90);
  });

  it("charges a reference seen for the first time", async () => {
    const { service, manager } = setup(null);

    const info = await service.useTokens({ ...usage, dedupeByReference: true });

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(info.availableTokens).toBe(87);
  });

  it("charges again when dedupe is not requested", async () => {
    const { service, manager } = setup({ id: "tx-1" } as TokenTransaction);

    await service.useTokens(usage);

    expect(manager.save).toHaveBeenCalledTimes(2);
  });
});
