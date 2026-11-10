import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { auth } from "../auth/better-auth";
import { CreateApiKeyDto } from "./dto/create-api-key.dto";
import { ApiKeyEnvironment, ApiKeyStatus } from "./entities/api-key.entity";
import { BetterAuthApiKey } from "./entities/better-auth-apikey.entity";
import { UpdateApiKeyDto } from "./dto/update-api-key.dto";

export interface ApiKeyResponse {
  id: string;
  name: string;
  key?: string;
  keyPrefix: string;
  environment: ApiKeyEnvironment;
  status: ApiKeyStatus;
  permissions: string[];
  ipWhitelist?: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  lastUsedIp?: string;
  usageCount: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  metadata?: Record<string, any>;
  project: { id: string; name: string };
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

type Verified = {
  id: string;
  name?: string | null;
  start?: string | null;
  referenceId: string;
  metadata?: Record<string, unknown>;
  permissions?: string | null;
  enabled?: boolean;
  expiresAt?: Date | null;
  lastRequest?: Date | null;
  requestCount?: number;
};

function parsePermissions(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as string[];
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, string[]>).flatMap(([resource, actions]) =>
        (Array.isArray(actions) ? actions : [String(actions)]).map(
          (action) => `${resource}:${action}`,
        ),
      );
    }
  } catch {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function toPermissionRecord(permissions: string[]): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const permission of permissions) {
    const [resource, action] = permission.split(":");
    if (!resource) continue;
    const key = resource;
    const verb = action ?? "use";
    if (!record[key]) record[key] = [];
    if (!record[key].includes(verb)) record[key].push(verb);
  }
  return record;
}

function metadataOf(key: Verified | unknown): Record<string, any> {
  const raw = (key as { metadata?: string | Record<string, any> | null } | null)?.metadata;
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, any>;
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return {};
  }
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(BetterAuthApiKey)
    private readonly keyRepository: Repository<BetterAuthApiKey>,
  ) {}

  async validateApiKey(key: string, _projectId?: string, ipAddress?: string) {
    if (!key) return null;
    const result = await auth.api.verifyApiKey({ body: { key, configId: "organization" } });
    if (!result.valid || !result.key) return null;
    const verified = result.key as unknown as Verified;
    if (verified.enabled === false) return null;
    if (verified.expiresAt && new Date(verified.expiresAt) < new Date()) return null;
    const meta = metadataOf(verified);
    const whitelist = (meta.ipWhitelist as string[] | undefined) ?? [];
    if (whitelist.length > 0 && ipAddress && !whitelist.includes(ipAddress)) return null;
    return {
      id: verified.id,
      keyPrefix: verified.start ?? verified.id,
      referenceId: verified.referenceId,
      permissions: parsePermissions(verified.permissions),
      environment: (meta.environment as ApiKeyEnvironment) ?? ApiKeyEnvironment.PRODUCTION,
      status: verified.enabled ? ApiKeyStatus.ACTIVE : ApiKeyStatus.REVOKED,
      isActive: !!verified.enabled,
      isExpired: verified.expiresAt ? new Date(verified.expiresAt) < new Date() : false,
      projectId: (meta.projectId as string | undefined) ?? "",
      tenantId: verified.referenceId,
      ipWhitelist: whitelist,
      rateLimitPerMinute: Number(meta.rateLimitPerMinute ?? 1000),
      rateLimitPerHour: Number(meta.rateLimitPerHour ?? 10000),
      rateLimitPerDay: Number(meta.rateLimitPerDay ?? 100000),
      usageCount: verified.requestCount ?? 0,
      lastUsedAt: verified.lastRequest ?? null,
    };
  }

  async createApiKey(
    tenantId: string,
    projectId: string,
    createdBy: string,
    createDto: CreateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    if (createdBy === "__system__") {
      throw new UnauthorizedException("Authenticated user required");
    }
    const existing = await this.keyRepository.findOne({
      where: { name: createDto.name, referenceId: tenantId },
    });
    if (existing) {
      throw new ConflictException(`An API key with the name "${createDto.name}" already exists`);
    }
    const metadata = {
      projectId,
      environment: createDto.environment ?? ApiKeyEnvironment.PRODUCTION,
      ipWhitelist: createDto.ipWhitelist ?? [],
      rateLimitPerMinute: createDto.rateLimitPerMinute ?? 1000,
      rateLimitPerHour: createDto.rateLimitPerHour ?? 10000,
      rateLimitPerDay: createDto.rateLimitPerDay ?? 100000,
      createdBy,
      ...(createDto.metadata ?? {}),
    };
    const created = await auth.api.createApiKey({
      body: {
        name: createDto.name,
        organizationId: tenantId,
        userId: createdBy,
        prefix: "sa_",
        expiresIn: createDto.expiresAt
          ? Math.max(0, Math.floor((new Date(createDto.expiresAt).getTime() - Date.now()) / 1000))
          : undefined,
        metadata,
        permissions: toPermissionRecord(createDto.permissions ?? []),
      } as never,
    });
    const key = (created as { key?: string })?.key ?? "";
    const row = await this.keyRepository.findOne({
      where: { id: (created as { id?: string })?.id ?? "" },
    });
    if (!row) throw new NotFoundException("API key not found after creation");
    return {
      id: row.id,
      name: row.name ?? createDto.name,
      key,
      keyPrefix: row.start ?? "",
      environment: metadata.environment,
      status: ApiKeyStatus.ACTIVE,
      permissions: createDto.permissions ?? [],
      ipWhitelist: metadata.ipWhitelist,
      expiresAt: row.expiresAt ?? undefined,
      lastUsedAt: row.lastRequest ?? undefined,
      usageCount: row.requestCount ?? 0,
      rateLimitPerMinute: metadata.rateLimitPerMinute,
      rateLimitPerHour: metadata.rateLimitPerHour,
      rateLimitPerDay: metadata.rateLimitPerDay,
      metadata,
      project: { id: projectId, name: "" },
      createdById: createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as ApiKeyResponse;
  }

  async getApiKeys(tenantId: string, projectId: string): Promise<ApiKeyResponse[]> {
    const rows = await this.keyRepository.find({ where: { referenceId: tenantId } });
    return rows
      .filter((row) => metadataOf(row).projectId === projectId)
      .map((row) => {
        const meta = metadataOf(row);
        return {
          id: row.id,
          name: row.name ?? "",
          keyPrefix: row.start ?? "",
          environment: (meta.environment as ApiKeyEnvironment) ?? ApiKeyEnvironment.PRODUCTION,
          status: row.enabled ? ApiKeyStatus.ACTIVE : ApiKeyStatus.REVOKED,
          permissions: parsePermissions(row.permissions),
          ipWhitelist: meta.ipWhitelist as string[] | undefined,
          expiresAt: row.expiresAt ?? undefined,
          lastUsedAt: row.lastRequest ?? undefined,
          usageCount: row.requestCount ?? 0,
          rateLimitPerMinute: Number(meta.rateLimitPerMinute ?? 1000),
          rateLimitPerHour: Number(meta.rateLimitPerHour ?? 10000),
          rateLimitPerDay: Number(meta.rateLimitPerDay ?? 100000),
          metadata: meta,
          project: { id: projectId, name: "" },
          createdById: (meta.createdBy as string) ?? "",
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        } as ApiKeyResponse;
      });
  }

  async updateApiKey(
    id: string,
    tenantId: string,
    projectId: string,
    updateData: UpdateApiKeyDto,
  ): Promise<ApiKeyResponse> {
    const row = await this.keyRepository.findOne({ where: { id, referenceId: tenantId } });
    if (!row) throw new NotFoundException("API key not found");
    await auth.api.updateApiKey({
      body: {
        keyId: id,
        name: updateData.name ?? row.name ?? "",
        enabled: updateData.status ? updateData.status === ApiKeyStatus.ACTIVE : row.enabled,
        expiresAt: updateData.expiresAt ? new Date(updateData.expiresAt) : row.expiresAt,
        metadata: {
          ...metadataOf(row),
          ipWhitelist: updateData.ipWhitelist ?? metadataOf(row).ipWhitelist ?? [],
          environment: metadataOf(row).environment,
        },
      } as never,
    });
    const refreshed = await this.keyRepository.findOne({ where: { id } });
    if (!refreshed) throw new NotFoundException("API key not found");
    const meta = metadataOf(refreshed);
    return {
      id: refreshed.id,
      name: refreshed.name ?? "",
      keyPrefix: refreshed.start ?? "",
      environment: (meta.environment as ApiKeyEnvironment) ?? ApiKeyEnvironment.PRODUCTION,
      status: refreshed.enabled ? ApiKeyStatus.ACTIVE : ApiKeyStatus.INACTIVE,
      permissions: parsePermissions(refreshed.permissions),
      ipWhitelist: meta.ipWhitelist as string[] | undefined,
      expiresAt: refreshed.expiresAt ?? undefined,
      lastUsedAt: refreshed.lastRequest ?? undefined,
      usageCount: refreshed.requestCount ?? 0,
      rateLimitPerMinute: Number(meta.rateLimitPerMinute ?? 1000),
      rateLimitPerHour: Number(meta.rateLimitPerHour ?? 10000),
      rateLimitPerDay: Number(meta.rateLimitPerDay ?? 100000),
      metadata: meta,
      project: { id: projectId, name: "" },
      createdById: (meta.createdBy as string) ?? "",
      createdAt: refreshed.createdAt,
      updatedAt: refreshed.updatedAt,
    } as ApiKeyResponse;
  }

  async revokeApiKey(id: string, tenantId: string, projectId: string): Promise<void> {
    const row = await this.keyRepository.findOne({ where: { id, referenceId: tenantId } });
    if (!row) throw new NotFoundException("API key not found");
    await auth.api.deleteApiKey({ body: { keyId: id } } as never);
  }
}
