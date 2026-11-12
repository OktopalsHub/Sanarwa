import type { ConfigService } from "@nestjs/config";
import type { AuthInfo } from "@modelcontextprotocol/server";
import type { McpTokenVerifier } from "@nestjs/mcp";
import { ApiKeyService } from "../api-key/api-key.service";

export class ApiKeyTokenVerifier implements McpTokenVerifier {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly configService: ConfigService,
  ) {}

  async verifyAccessToken(token: string): Promise<AuthInfo | null> {
    const apiKey = await this.apiKeyService.validateApiKey(token);
    if (!apiKey?.tenantId) {
      return null;
    }

    return {
      token,
      clientId: apiKey.id,
      scopes: apiKey.permissions ?? [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      resource: new URL(this.mcpResource()),
      extra: {
        tenantId: apiKey.tenantId,
        projectId: apiKey.projectId || undefined,
        keyPrefix: apiKey.keyPrefix,
        environment: apiKey.environment,
      },
    };
  }

  private mcpResource(): string {
    return this.configService.get<string>("MCP_RESOURCE") ?? "http://localhost:8000/mcp";
  }
}
