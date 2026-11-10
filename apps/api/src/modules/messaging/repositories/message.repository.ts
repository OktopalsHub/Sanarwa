import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseRepository } from "../../../common/database/repositories/base.repository";
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
