import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { assertSafeWebhookUrl } from '../../common/security/utils/safe-url';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Webhook } from './entities/webhook.entity';

@Injectable()
export class WebhookService {
  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
  ) {}

  async create(
    tenantId: string,
    createWebhookDto: CreateWebhookDto,
  ): Promise<Webhook> {
    try {
      assertSafeWebhookUrl(createWebhookDto.url);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid webhook URL',
      );
    }

    // Check if webhook with same URL already exists for this tenant
    const existing = await this.webhookRepository.findOne({
      where: { tenantId, url: createWebhookDto.url },
    });

    if (existing) {
      throw new ConflictException(
        `Webhook with URL ${createWebhookDto.url} already exists for this tenant`,
      );
    }

    const webhook = this.webhookRepository.create({
      ...createWebhookDto,
      tenantId,
    });

    return this.webhookRepository.save(webhook);
  }

  async findAll(tenantId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tenantId: string, id: string): Promise<Webhook> {
    const webhook = await this.webhookRepository.findOne({
      where: { id, tenantId },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }

    return webhook;
  }

  async update(
    tenantId: string,
    id: string,
    updateWebhookDto: UpdateWebhookDto,
  ): Promise<Webhook> {
    const webhook = await this.findOne(tenantId, id);

    // Check URL uniqueness if URL is being updated
    if (updateWebhookDto.url && updateWebhookDto.url !== webhook.url) {
      try {
        assertSafeWebhookUrl(updateWebhookDto.url);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid webhook URL',
        );
      }
      const existing = await this.webhookRepository.findOne({
        where: { tenantId, url: updateWebhookDto.url },
      });

      if (existing) {
        throw new ConflictException(
          `Webhook with URL ${updateWebhookDto.url} already exists for this tenant`,
        );
      }
    }

    Object.assign(webhook, updateWebhookDto);
    return this.webhookRepository.save(webhook);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const webhook = await this.findOne(tenantId, id);
    await this.webhookRepository.remove(webhook);
  }

  async findActiveWebhooksForEvent(
    tenantId: string,
    event: string,
  ): Promise<Webhook[]> {
    return this.webhookRepository
      .createQueryBuilder('webhook')
      .where('webhook.tenantId = :tenantId', { tenantId })
      .andWhere('webhook.active = true')
      .andWhere(':event = ANY(webhook.events)', { event })
      .getMany();
  }
}
