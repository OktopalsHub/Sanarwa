import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import type { Redis } from "ioredis";
import { ApiKeyService } from "./api-key.service";
import { TokenManagementService } from "../token-management/services/token-management.service";

export interface ApiKeyPrincipal {
  id: string;
  keyPrefix: string;
  projectId?: string | null;
  tenantId?: string | null;
  permissions: string[];
  environment?: string;
}

export interface VerifyApiKeyRequest {
  apiKey: string;
  ipAddress?: string;
  requiredPermissions?: string[];
}

@Injectable()
export class ApiKeyVerificationService {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    @Optional() private readonly tokenManagementService?: TokenManagementService,
    @Optional() @InjectRedis() private readonly redis?: Redis,
  ) {}

  async verify(request: VerifyApiKeyRequest): Promise<ApiKeyPrincipal> {
    const { apiKey, ipAddress = "unknown", requiredPermissions = [] } = request;

    const validatedKey = await this.apiKeyService.validateApiKey(apiKey, undefined, ipAddress);
    if (!validatedKey) {
      throw new UnauthorizedException("Invalid or inactive API key");
    }

    if (validatedKey.isExpired) {
      throw new ForbiddenException("API key has expired");
    }

    if (validatedKey.status === "revoked") {
      throw new ForbiddenException("API key has been revoked");
    }

    if (validatedKey.ipWhitelist && validatedKey.ipWhitelist.length > 0) {
      if (!validatedKey.ipWhitelist.includes(ipAddress)) {
        throw new ForbiddenException(`IP address ${ipAddress} is not whitelisted for this API key`);
      }
    }

    await this.checkRateLimits(validatedKey.id, validatedKey);

    if (validatedKey.tenantId) {
      await this.checkTokenQuota(validatedKey.tenantId);
    }

    if (requiredPermissions.length > 0) {
      this.checkPermissions(validatedKey.permissions ?? [], requiredPermissions);
    }

    return {
      id: validatedKey.id,
      keyPrefix: validatedKey.keyPrefix,
      projectId: validatedKey.projectId,
      tenantId: validatedKey.tenantId,
      permissions: validatedKey.permissions ?? [],
      environment: validatedKey.environment,
    };
  }

  private async checkRateLimits(apiKeyId: string, apiKey: any): Promise<void> {
    const limits = [
      { name: "minute", seconds: 60, limit: Number(apiKey.rateLimitPerMinute) },
      { name: "hour", seconds: 60 * 60, limit: Number(apiKey.rateLimitPerHour) },
      { name: "day", seconds: 24 * 60 * 60, limit: Number(apiKey.rateLimitPerDay) },
    ];

    if (limits.some(({ limit }) => !Number.isFinite(limit) || limit <= 0)) {
      throw new BadRequestException("API key rate limits not configured");
    }

    if (!this.redis) {
      throw new ServiceUnavailableException("API key rate limiting is unavailable");
    }

    const script =
      "local current = redis.call('INCR', KEYS[1]); " +
      "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
      "return current;";

    for (const { name, seconds, limit } of limits) {
      const key = `sanarwa:api-key-rate:${apiKeyId}:${name}`;
      const result = await this.redis.eval(script, 1, key, seconds);
      const count = Number(result);

      if (!Number.isFinite(count)) {
        throw new ServiceUnavailableException("Failed to check API key rate limit");
      }

      if (count > limit) {
        throw new ForbiddenException(`API key ${name} rate limit exceeded`);
      }
    }
  }

  private async checkTokenQuota(tenantId: string): Promise<void> {
    if (!this.tokenManagementService) return;

    try {
      const balance = await this.tokenManagementService.getBalance(tenantId);
      if (balance.availableTokens <= 0) {
        throw new ForbiddenException("Insufficient token balance. Please purchase more tokens.");
      }
      if (balance.availableTokens < balance.totalTokens * 0.1) {
        console.warn(
          `Low token balance for tenant ${tenantId}: ${balance.availableTokens}/${balance.totalTokens}`,
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      throw new BadRequestException("Failed to check token quota");
    }
  }

  private checkPermissions(keyPermissions: string[], requiredPermissions: string[]): void {
    const hasAllPermissions = requiredPermissions.every(
      (required) => keyPermissions.includes(required) || keyPermissions.includes("*"),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (required) => !keyPermissions.includes(required),
      );
      throw new ForbiddenException(`Missing permissions: ${missingPermissions.join(", ")}`);
    }
  }
}
