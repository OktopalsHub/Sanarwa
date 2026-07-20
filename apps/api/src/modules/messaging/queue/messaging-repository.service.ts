import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageDelivery } from '../message-delivery.entity';
import { Message } from '../message.entity';

@Injectable()
export class MessagingRepositoryService {
  constructor(
    @InjectRepository(Message)
    public readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    public readonly deliveryRepository: Repository<MessageDelivery>,
  ) { }
}