import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  TokenBalance,
  TokenTransaction,
  TokenTransactionType,
} from "../../billing/entities/token-balance.entity";

export interface TokenUsageDto {
  tenantId: string;
  amount: number;
  description?: string;
  metadata?: any;
  referenceId?: string;
}

export interface TokenBalanceInfo {
  totalTokens: number;
  usedTokens: number;
  availableTokens: number;
  reservedTokens: number;
  lastUsage?: Date;
  lastPurchase?: Date;
}

@Injectable()
export class TokenManagementService {
  private readonly logger = new Logger(TokenManagementService.name);

  constructor(
    @InjectRepository(TokenBalance)
    private tokenBalanceRepository: Repository<TokenBalance>,
    @InjectRepository(TokenTransaction)
    private tokenTransactionRepository: Repository<TokenTransaction>,
    private dataSource: DataSource,
  ) {}

  async getBalance(tenantId: string): Promise<TokenBalanceInfo> {
    try {
      let balance = await this.tokenBalanceRepository.findOne({
        where: { tenantId },
      });

      if (!balance) {
        // Create initial balance record
        balance = this.tokenBalanceRepository.create({
          tenantId,
          totalTokens: 0,
          usedTokens: 0,
          availableTokens: 0,
          reservedTokens: 0,
        });
        balance = await this.tokenBalanceRepository.save(balance);
      }

      return {
        totalTokens: Number(balance.totalTokens),
        usedTokens: Number(balance.usedTokens),
        availableTokens: Number(balance.availableTokens),
        reservedTokens: Number(balance.reservedTokens),
        lastUsage: balance.lastUsage,
        lastPurchase: balance.lastPurchase,
      };
    } catch (error) {
      this.logger.error(`Failed to get token balance for tenant ${tenantId}:`, error);
      throw new BadRequestException("Failed to get token balance");
    }
  }

  async addTokens(
    tenantId: string,
    amount: number,
    type: TokenTransactionType,
    description?: string,
    metadata?: any,
    referenceId?: string,
  ): Promise<TokenBalanceInfo> {
    if (amount <= 0) {
      throw new BadRequestException("Token amount must be positive");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Purchase transactions are idempotent by referenceId. This protects
      // webhook/sync retries even if the purchase claim is retried.
      if (type === TokenTransactionType.PURCHASE && referenceId) {
        const existingTransaction = await queryRunner.manager.findOne(TokenTransaction, {
          where: { tenantId, type, referenceId },
        });

        if (existingTransaction) {
          const existingBalance = await queryRunner.manager.findOne(TokenBalance, {
            where: { tenantId },
          });
          if (!existingBalance) {
            throw new BadRequestException("Token balance not found for existing purchase");
          }
          await queryRunner.rollbackTransaction();
          return {
            totalTokens: Number(existingBalance.totalTokens),
            usedTokens: Number(existingBalance.usedTokens),
            availableTokens: Number(existingBalance.availableTokens),
            reservedTokens: Number(existingBalance.reservedTokens),
            lastUsage: existingBalance.lastUsage,
            lastPurchase: existingBalance.lastPurchase,
          };
        }
      }

      // Get or create balance record with lock
      let balance = await queryRunner.manager.findOne(TokenBalance, {
        where: { tenantId },
        lock: { mode: "pessimistic_write" },
      });

      if (!balance) {
        balance = queryRunner.manager.create(TokenBalance, {
          tenantId,
          totalTokens: 0,
          usedTokens: 0,
          availableTokens: 0,
          reservedTokens: 0,
        });
      }

      // Update balance
      const newTotalTokens = Number(balance.totalTokens) + amount;
      const newAvailableTokens = Number(balance.availableTokens) + amount;

      balance.totalTokens = newTotalTokens;
      balance.availableTokens = newAvailableTokens;

      if (type === TokenTransactionType.PURCHASE) {
        balance.lastPurchase = new Date();
      }

      await queryRunner.manager.save(balance);

      // Create transaction record
      const transaction = queryRunner.manager.create(TokenTransaction, {
        tenantId,
        type,
        amount,
        balanceAfter: newAvailableTokens,
        description: description || `Added ${amount} tokens`,
        metadata,
        referenceId,
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Added ${amount} tokens to tenant ${tenantId}. New balance: ${newAvailableTokens}`,
      );

      return {
        totalTokens: newTotalTokens,
        usedTokens: Number(balance.usedTokens),
        availableTokens: newAvailableTokens,
        reservedTokens: Number(balance.reservedTokens),
        lastUsage: balance.lastUsage,
        lastPurchase: balance.lastPurchase,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to add tokens for tenant ${tenantId}:`, error);
      throw new BadRequestException("Failed to add tokens");
    } finally {
      await queryRunner.release();
    }
  }

  async useTokens(dto: TokenUsageDto): Promise<TokenBalanceInfo> {
    if (dto.amount <= 0) {
      throw new BadRequestException("Token amount must be positive");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get balance record with lock
      const balance = await queryRunner.manager.findOne(TokenBalance, {
        where: { tenantId: dto.tenantId },
        lock: { mode: "pessimistic_write" },
      });

      if (!balance) {
        throw new BadRequestException("No token balance found for tenant");
      }

      const availableTokens = Number(balance.availableTokens);

      if (availableTokens < dto.amount) {
        throw new BadRequestException(
          `Insufficient tokens. Available: ${availableTokens}, Required: ${dto.amount}`,
        );
      }

      // Update balance
      const newUsedTokens = Number(balance.usedTokens) + dto.amount;
      const newAvailableTokens = availableTokens - dto.amount;

      balance.usedTokens = newUsedTokens;
      balance.availableTokens = newAvailableTokens;
      balance.lastUsage = new Date();

      await queryRunner.manager.save(balance);

      // Create transaction record
      const transaction = queryRunner.manager.create(TokenTransaction, {
        tenantId: dto.tenantId,
        type: TokenTransactionType.USAGE,
        amount: -dto.amount, // Negative for usage
        balanceAfter: newAvailableTokens,
        description: dto.description || `Used ${dto.amount} tokens`,
        metadata: dto.metadata,
        referenceId: dto.referenceId,
      });

      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Used ${dto.amount} tokens for tenant ${dto.tenantId}. Remaining: ${newAvailableTokens}`,
      );

      return {
        totalTokens: Number(balance.totalTokens),
        usedTokens: newUsedTokens,
        availableTokens: newAvailableTokens,
        reservedTokens: Number(balance.reservedTokens),
        lastUsage: balance.lastUsage,
        lastPurchase: balance.lastPurchase,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to use tokens for tenant ${dto.tenantId}:`, error);
      throw new BadRequestException("Failed to use tokens");
    } finally {
      await queryRunner.release();
    }
  }

  async reserveTokens(tenantId: string, amount: number, referenceId?: string): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException("Token amount must be positive");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const balance = await queryRunner.manager.findOne(TokenBalance, {
        where: { tenantId },
        lock: { mode: "pessimistic_write" },
      });

      if (!balance) {
        throw new BadRequestException("No token balance found for tenant");
      }

      const availableTokens = Number(balance.availableTokens);

      if (availableTokens < amount) {
        throw new BadRequestException(
          `Insufficient tokens to reserve. Available: ${availableTokens}, Required: ${amount}`,
        );
      }

      balance.availableTokens = availableTokens - amount;
      balance.reservedTokens = Number(balance.reservedTokens) + amount;

      await queryRunner.manager.save(balance);
      await queryRunner.commitTransaction();

      this.logger.log(`Reserved ${amount} tokens for tenant ${tenantId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to reserve tokens for tenant ${tenantId}:`, error);
      throw new BadRequestException("Failed to reserve tokens");
    } finally {
      await queryRunner.release();
    }
  }

  async releaseReservedTokens(tenantId: string, amount: number, consume = false): Promise<void> {
    if (amount <= 0) {
      throw new BadRequestException("Token amount must be positive");
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const balance = await queryRunner.manager.findOne(TokenBalance, {
        where: { tenantId },
        lock: { mode: "pessimistic_write" },
      });

      if (!balance) {
        throw new BadRequestException("No token balance found for tenant");
      }

      const reservedTokens = Number(balance.reservedTokens);

      if (reservedTokens < amount) {
        throw new BadRequestException(
          `Insufficient reserved tokens. Reserved: ${reservedTokens}, Requested: ${amount}`,
        );
      }

      balance.reservedTokens = reservedTokens - amount;

      if (consume) {
        // Consume the tokens (mark as used)
        balance.usedTokens = Number(balance.usedTokens) + amount;
        balance.lastUsage = new Date();

        // Create usage transaction
        const transaction = queryRunner.manager.create(TokenTransaction, {
          tenantId,
          type: TokenTransactionType.USAGE,
          amount: -amount,
          balanceAfter: Number(balance.availableTokens),
          description: `Consumed ${amount} reserved tokens`,
        });

        await queryRunner.manager.save(transaction);
      } else {
        // Release back to available
        balance.availableTokens = Number(balance.availableTokens) + amount;
      }

      await queryRunner.manager.save(balance);
      await queryRunner.commitTransaction();

      this.logger.log(
        `${consume ? "Consumed" : "Released"} ${amount} reserved tokens for tenant ${tenantId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(`Failed to release reserved tokens for tenant ${tenantId}:`, error);
      throw new BadRequestException("Failed to release reserved tokens");
    } finally {
      await queryRunner.release();
    }
  }

  async getTransactionHistory(
    tenantId: string,
    limit = 50,
    offset = 0,
    type?: TokenTransactionType,
  ): Promise<{ transactions: TokenTransaction[]; total: number }> {
    try {
      const queryBuilder = this.tokenTransactionRepository
        .createQueryBuilder("transaction")
        .where("transaction.tenantId = :tenantId", { tenantId })
        .orderBy("transaction.createdAt", "DESC")
        .skip(offset)
        .take(limit);

      if (type) {
        queryBuilder.andWhere("transaction.type = :type", { type });
      }

      const [transactions, total] = await queryBuilder.getManyAndCount();

      return { transactions, total };
    } catch (error) {
      this.logger.error(`Failed to get transaction history for tenant ${tenantId}:`, error);
      throw new BadRequestException("Failed to get transaction history");
    }
  }

  async checkSufficientTokens(tenantId: string, requiredAmount: number): Promise<boolean> {
    try {
      const balance = await this.getBalance(tenantId);
      return balance.availableTokens >= requiredAmount;
    } catch (error) {
      this.logger.error(`Failed to check token sufficiency for tenant ${tenantId}:`, error);
      return false;
    }
  }

  async getTokenUsageStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalUsed: number;
    totalPurchased: number;
    dailyUsage: { date: string; usage: number }[];
  }> {
    try {
      const transactions = await this.tokenTransactionRepository
        .createQueryBuilder("transaction")
        .where("transaction.tenantId = :tenantId", { tenantId })
        .andWhere("transaction.createdAt BETWEEN :startDate AND :endDate", {
          startDate,
          endDate,
        })
        .orderBy("transaction.createdAt", "ASC")
        .getMany();

      let totalUsed = 0;
      let totalPurchased = 0;
      const dailyUsage: { [date: string]: number } = {};

      for (const transaction of transactions) {
        const amount = Number(transaction.amount);
        const date = transaction.createdAt.toISOString().split("T")[0];

        if (transaction.type === TokenTransactionType.USAGE) {
          totalUsed += Math.abs(amount);
          dailyUsage[date] = (dailyUsage[date] || 0) + Math.abs(amount);
        } else if (transaction.type === TokenTransactionType.PURCHASE) {
          totalPurchased += amount;
        }
      }

      const dailyUsageArray = Object.entries(dailyUsage).map(([date, usage]) => ({
        date,
        usage,
      }));

      return {
        totalUsed,
        totalPurchased,
        dailyUsage: dailyUsageArray,
      };
    } catch (error) {
      this.logger.error(`Failed to get token usage stats for tenant ${tenantId}:`, error);
      throw new BadRequestException("Failed to get token usage stats");
    }
  }
}
