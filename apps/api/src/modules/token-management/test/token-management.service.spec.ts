import { Test, TestingModule } from "@nestjs/testing";
import { TokenManagementService } from "../services/token-management.service";
import { Repository, DataSource } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TokenBalance, TokenTransaction } from "../../billing/entities/token-balance.entity";
import type { Mock, Mocked } from "vitest";

describe("TokenManagementService", () => {
  let service: TokenManagementService;
  let tokenBalanceRepository: Mocked<Repository<TokenBalance>>;
  let tokenTransactionRepository: Mocked<Repository<TokenTransaction>>;

  beforeEach(async () => {
    const mockRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn(),
        getOne: vi.fn(),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenManagementService,
        {
          provide: getRepositoryToken(TokenBalance),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TokenTransaction),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: vi.fn((cb) => cb({})),
          },
        },
      ],
    }).compile();

    service = module.get<TokenManagementService>(TokenManagementService);
    tokenBalanceRepository = module.get(getRepositoryToken(TokenBalance));
    tokenTransactionRepository = module.get(getRepositoryToken(TokenTransaction));
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getBalance", () => {
    it("should return the tenant's token balance", async () => {
      tokenBalanceRepository.findOne.mockResolvedValue({
        tenantId: "tenant-1",
        totalTokens: 100,
        usedTokens: 30,
        availableTokens: 70,
        reservedTokens: 0,
      } as TokenBalance);

      const result = await service.getBalance("tenant-1");

      expect(result.totalTokens).toBe(100);
      expect(result.availableTokens).toBe(70);
    });

    it("should create a zero balance when the tenant has none", async () => {
      tokenBalanceRepository.findOne.mockResolvedValue(null);
      tokenBalanceRepository.create.mockReturnValue({
        tenantId: "tenant-1",
        totalTokens: 0,
        usedTokens: 0,
        availableTokens: 0,
        reservedTokens: 0,
      } as TokenBalance);
      tokenBalanceRepository.save.mockResolvedValue({
        tenantId: "tenant-1",
        totalTokens: 0,
        usedTokens: 0,
        availableTokens: 0,
        reservedTokens: 0,
      } as TokenBalance);

      const result = await service.getBalance("tenant-1");

      expect(result.availableTokens).toBe(0);
    });
  });

  describe("checkSufficientTokens", () => {
    it("should return false when the tenant has insufficient tokens", async () => {
      tokenBalanceRepository.findOne.mockResolvedValue({
        tenantId: "tenant-1",
        totalTokens: 10,
        usedTokens: 10,
        availableTokens: 0,
        reservedTokens: 0,
      } as TokenBalance);

      await expect(service.checkSufficientTokens("tenant-1", 5)).resolves.toBe(false);
    });

    it("should return true when the tenant has enough tokens", async () => {
      tokenBalanceRepository.findOne.mockResolvedValue({
        tenantId: "tenant-1",
        totalTokens: 100,
        usedTokens: 0,
        availableTokens: 100,
        reservedTokens: 0,
      } as TokenBalance);

      await expect(service.checkSufficientTokens("tenant-1", 5)).resolves.toBe(true);
    });
  });
});
