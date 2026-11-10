import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { ProjectStatus } from "../../common/enums/project.enum";
import { Project } from "../project/entities/project.entity";
import { ProviderConfigValidator } from "../provider/provider-config-validator";
import { ProviderConfig } from "../provider/provider-config.entity";
import { ProviderConfigRepository } from "../provider/provider-config.repository";
import { ProviderEncryptionService } from "../provider/provider-encryption.service";
import { ProviderOrchestratorService } from "../provider/provider-orchestrator.service";
import { ProviderSendOutcome } from "../provider/provider-send-outcome";
import { ProviderService } from "../provider/provider.service";
import { ConnectChannelDto, TestChannelDto } from "./dto/connect-channel.dto";
import {
  CONNECTABLE_CHANNELS,
  ConnectableChannel,
  findConnectableChannel,
} from "./channels.constants";

export interface ChannelConnectionSummary {
  providerId: string;
  name: string;
  isActive: boolean;
  destination: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelSummary {
  key: string;
  providerId: string;
  label: string;
  description: string;
  channel: NotificationChannel;
  connected: boolean;
  connection: ChannelConnectionSummary | null;
}

export interface UpsertChannelResult {
  providerId: string;
  name: string;
  isActive: boolean;
  destination: string | null;
}

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly providerConfigRepository: ProviderConfigRepository,
    private readonly providerService: ProviderService,
    private readonly configValidator: ProviderConfigValidator,
    private readonly encryptionService: ProviderEncryptionService,
    private readonly orchestrator: ProviderOrchestratorService,
  ) {}

  async list(tenantId: string): Promise<ChannelSummary[]> {
    const configs = await this.providerConfigRepository.findByTenantId(tenantId);
    const decrypted = await Promise.all(
      configs.map(async (config) => ({
        config: await this.encryptionService.decrypt(config.config),
        record: config,
      })),
    );
    const byProvider = new Map(decrypted.map((entry) => [entry.record.providerId, entry]));

    return CONNECTABLE_CHANNELS.map((definition) => {
      const entry = byProvider.get(definition.providerId);
      return {
        key: definition.key,
        providerId: definition.providerId,
        label: definition.label,
        description: definition.description,
        channel: definition.channel,
        connected: Boolean(entry),
        connection: entry ? this.toSummary(definition, entry.record, entry.config) : null,
      };
    });
  }

  async upsert(
    tenantId: string,
    memberId: string,
    providerId: string,
    dto: ConnectChannelDto,
  ): Promise<UpsertChannelResult> {
    const definition = this.requireConnectable(providerId);
    await this.assertConfigValid(definition, dto.config);

    const existing = await this.findConfig(tenantId, providerId);
    const name = dto.name?.trim() || definition.label;
    const isActive = dto.isActive ?? true;

    if (existing) {
      const updated = await this.providerService.updateConfig(tenantId, existing.id, {
        providerName: name,
        providerType: definition.providerType,
        config: dto.config,
        isActive,
      });
      this.logger.log(`Updated ${providerId} connection for tenant ${tenantId}`);
      return this.toUpsertResult(definition, updated, dto.config);
    }

    const project = await this.ensureProject(tenantId, memberId);
    const created = await this.providerService.createConfig({
      projectId: project.id,
      providerId: definition.providerId,
      providerName: name,
      providerType: definition.providerType,
      channel: definition.channel,
      config: dto.config,
      priority: 1,
      isActive,
      isDefault: true,
      createdBy: { id: memberId },
    });

    this.logger.log(`Created ${providerId} connection for tenant ${tenantId}`);
    return this.toUpsertResult(definition, created, dto.config);
  }

  async remove(tenantId: string, providerId: string): Promise<void> {
    this.requireConnectable(providerId);
    const existing = await this.findConfig(tenantId, providerId);
    if (!existing) {
      throw new NotFoundException(`${providerId} is not connected for this tenant`);
    }

    await this.providerService.removeConfig(tenantId, existing.id);
    this.logger.log(`Removed ${providerId} connection for tenant ${tenantId}`);
  }

  async test(
    tenantId: string,
    providerId: string,
    dto: TestChannelDto,
  ): Promise<{ ok: boolean; outcome: ProviderSendOutcome; message: string }> {
    const definition = this.requireConnectable(providerId);
    const existing = await this.findConfig(tenantId, providerId);
    if (!existing) {
      throw new NotFoundException(`${providerId} is not connected for this tenant`);
    }

    const config = (await this.providerService.findConfigById(tenantId, existing.id)).config;
    const verifyOnly = dto.verifyOnly ?? providerId === "whatsapp";

    if (providerId === "whatsapp" && !verifyOnly && !dto.to) {
      throw new BadRequestException("A recipient number is required to send a WhatsApp test");
    }

    const destination = dto.to ?? this.sendDestination(providerId, config);
    if (!verifyOnly && !destination) {
      throw new BadRequestException(
        `A destination is required to test ${definition.label}. Set a default destination when connecting.`,
      );
    }

    const outcome = await this.orchestrator.testChatConnection(
      {
        channel: verifyOnly ? "" : destination!,
        message: dto.message?.trim() || "Sanarwa test message",
      },
      providerId,
      tenantId,
      { verifyOnly },
    );

    return {
      ok: outcome.status === "sent",
      outcome,
      message:
        outcome.status === "sent"
          ? verifyOnly
            ? "Credentials verified"
            : "Test message sent"
          : outcome.reason,
    };
  }

  async findConfig(tenantId: string, providerId: string): Promise<ProviderConfig | null> {
    const configs = await this.providerConfigRepository.findByTenantId(tenantId);
    return configs.find((config) => config.providerId === providerId) ?? null;
  }

  /**
   * Reuses the tenant's oldest project so channel credentials keep working with
   * the tenant-scoped BYOP lookup. Creates a "Default" project on first use.
   */
  async ensureProject(tenantId: string, memberId: string): Promise<Project> {
    const existing = await this.projectRepository.findOne({
      where: { tenantId },
      order: { createdAt: "ASC" },
    });
    if (existing) {
      return existing;
    }

    const created = this.projectRepository.create({
      tenantId,
      name: "Default",
      status: ProjectStatus.ACTIVE,
      createdBy: { id: memberId },
    });

    return this.projectRepository.save(created);
  }

  private requireConnectable(providerId: string): ConnectableChannel {
    const definition = findConnectableChannel(providerId);
    if (!definition) {
      throw new BadRequestException(
        `Unsupported channel '${providerId}'. Choose one of: ${CONNECTABLE_CHANNELS.map((c) => c.providerId).join(", ")}`,
      );
    }
    return definition;
  }

  private async assertConfigValid(
    definition: ConnectableChannel,
    config: Record<string, unknown>,
  ): Promise<void> {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new BadRequestException("config must be an object");
    }

    const candidate = {
      providerId: definition.providerId,
      providerName: definition.label,
      providerType: definition.providerType,
      channel: definition.channel,
      config,
      priority: 1,
    } as ProviderConfig;

    const result = await this.configValidator.validateDetailed(candidate);
    if (!result.isValid) {
      throw new BadRequestException(result.errors.join(". "));
    }
  }

  private toSummary(
    definition: ConnectableChannel,
    config: ProviderConfig,
    values: Record<string, unknown>,
  ): ChannelConnectionSummary {
    return {
      providerId: definition.providerId,
      name: config.providerName,
      isActive: config.isActive,
      destination: this.summaryDestination(definition.providerId, values),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private toUpsertResult(
    definition: ConnectableChannel,
    config: ProviderConfig,
    submitted: Record<string, unknown>,
  ): UpsertChannelResult {
    return {
      providerId: definition.providerId,
      name: config.providerName,
      isActive: config.isActive,
      destination: this.summaryDestination(definition.providerId, submitted),
    };
  }

  /**
   * Non-secret destination hint shown in the UI. Credentials never leave the API.
   */
  private summaryDestination(providerId: string, config: Record<string, any>): string | null {
    const value =
      providerId === "slack"
        ? (config.defaultChannel ?? hostOf(config.webhookUrl))
        : providerId === "discord"
          ? hostOf(config.webhookUrl)
          : providerId === "telegram"
            ? config.defaultChatId
            : config.phoneNumberId;

    return typeof value === "string" && value.length > 0 ? value : null;
  }

  /**
   * Destination handed to the provider when the caller names none.
   */
  private sendDestination(providerId: string, config: Record<string, any>): string | null {
    const value =
      providerId === "slack"
        ? (config.defaultChannel ?? config.webhookUrl)
        : providerId === "discord"
          ? config.webhookUrl
          : providerId === "telegram"
            ? config.defaultChatId
            : undefined;

    return typeof value === "string" && value.length > 0 ? value : null;
  }
}

function hostOf(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}
