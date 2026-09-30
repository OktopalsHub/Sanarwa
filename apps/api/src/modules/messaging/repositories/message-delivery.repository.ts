import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { BaseRepository } from "../../../database/repositories/base.repository";
import { Repository } from "typeorm";
import { MessageDelivery, MessageDeliveryStatus } from "../message-delivery.entity";
import { MessageChannel } from "../message.entity";

@Injectable()
export class MessageDeliveryRepository extends BaseRepository<MessageDelivery> {
  constructor(
    @InjectRepository(MessageDelivery)
    private readonly messageDeliveryRepository: Repository<MessageDelivery>,
  ) {
    super(messageDeliveryRepository);
  }

  async findByMessageId(messageId: string): Promise<MessageDelivery[]> {
    return this.find({
      where: { messageId },
      order: { createdAt: "ASC" },
    });
  }

  async findByStatus(status: MessageDeliveryStatus): Promise<MessageDelivery[]> {
    return this.find({
      where: { status },
      relations: ["message"],
      order: { createdAt: "ASC" },
    });
  }

  async findByChannel(channel: MessageChannel): Promise<MessageDelivery[]> {
    return this.find({
      where: { channel },
      relations: ["message"],
      order: { createdAt: "DESC" },
    });
  }

  async findByProviderMessageId(providerMessageId: string): Promise<MessageDelivery | null> {
    return this.findOne({
      where: { providerMessageId },
      relations: ["message"],
    });
  }

  async findFailedDeliveries(maxRetries = 3): Promise<MessageDelivery[]> {
    return this.messageDeliveryRepository
      .createQueryBuilder("delivery")
      .where("delivery.status = :status", {
        status: MessageDeliveryStatus.FAILED,
      })
      .andWhere("delivery.retryCount < :maxRetries", { maxRetries })
      .leftJoinAndSelect("delivery.message", "message")
      .getMany();
  }

  async updateDeliveryStatus(
    id: string,
    status: MessageDeliveryStatus,
    metadata?: Record<string, any>,
  ): Promise<MessageDelivery | null> {
    const updateData: any = { status };

    if (status === MessageDeliveryStatus.SENT) {
      updateData.sentAt = new Date();
    } else if (status === MessageDeliveryStatus.DELIVERED) {
      updateData.deliveredAt = new Date();
    } else if (status === MessageDeliveryStatus.OPENED) {
      updateData.openedAt = new Date();
    } else if (status === MessageDeliveryStatus.CLICKED) {
      updateData.clickedAt = new Date();
    }

    if (metadata) {
      updateData.metadata = metadata;
    }

    return this.update(id, updateData);
  }
}
