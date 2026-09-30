import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseRepository } from "../../../database/repositories/base.repository";
import { Repository } from "typeorm";
import { Message, MessagePriority, MessageStatus } from "../message.entity";

@Injectable()
export class MessageRepository extends BaseRepository<Message> {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {
    super(messageRepository);
  }

  async findByTenantId(tenantId: string, limit = 50, offset = 0): Promise<Message[]> {
    return this.messageRepository.find({
      where: { tenantId },
      order: { createdAt: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async findByStatus(status: MessageStatus, tenantId?: string): Promise<Message[]> {
    const where: any = { status };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    return this.find({
      where,
      relations: ["deliveries"],
      order: { createdAt: "ASC" },
    });
  }

  async findScheduledMessages(beforeDate: Date): Promise<Message[]> {
    return this.messageRepository
      .createQueryBuilder("message")
      .where("message.status = :status", { status: MessageStatus.PENDING })
      .andWhere("message.scheduledAt <= :beforeDate", { beforeDate })
      .andWhere("message.scheduledAt IS NOT NULL")
      .orderBy("message.scheduledAt", "ASC") // Optimize: Process oldest first
      .limit(1000) // Prevent loading too many at once
      .getMany();
  }

  async findByPriority(priority: MessagePriority, tenantId?: string): Promise<Message[]> {
    const where: any = { priority };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    return this.find({
      where,
      relations: ["deliveries"],
      order: { createdAt: "DESC" },
    });
  }

  async findFailedMessages(tenantId?: string, maxRetries = 3): Promise<Message[]> {
    const queryBuilder = this.messageRepository
      .createQueryBuilder("message")
      .where("message.status = :status", { status: MessageStatus.FAILED })
      .andWhere("message.retryCount < :maxRetries", { maxRetries });

    if (tenantId) {
      queryBuilder.andWhere("message.tenantId = :tenantId", { tenantId });
    }

    return queryBuilder.getMany();
  }
}
