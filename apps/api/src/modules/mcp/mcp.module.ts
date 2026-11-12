import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { McpModule } from "@nestjs/mcp";
import { Public } from "../auth/decorators/public.decorator";
import { ApiKeyModule } from "../api-key/api-key.module";
import { ApiKeyService } from "../api-key/api-key.service";
import { AnalyticsModule } from "../analytics/analytics.module";
import { MessagingModule } from "../messaging/messaging.module";
import { TokenManagementModule } from "../token-management/token-management.module";
import { ApiKeyTokenVerifier } from "./api-key-token.verifier";
import { MCP_SCOPES } from "./mcp-scopes";
import { SanarwaMcpTools } from "./mcp.tools";

@Module({
  imports: [
    ApiKeyModule,
    AnalyticsModule,
    MessagingModule,
    TokenManagementModule,
    McpModule.forRootAsync({
      path: "mcp",
      decorators: [Public()],
      imports: [ConfigModule, ApiKeyModule],
      inject: [ConfigService, ApiKeyService],
      useFactory: (config: ConfigService, apiKeyService: ApiKeyService) => {
        const resource = config.get<string>("MCP_RESOURCE") ?? "http://localhost:8000/mcp";
        return {
          name: "sanarwa",
          version: "0.0.1",
          instructions:
            "Sanarwa is a multi-tenant notification platform. Check get-token-balance before a send: sends spend tokens. Message ids returned by sends are transient; only persisted (scheduled) messages have a readable status. Your credential's scopes decide which tools are allowed; a 403 names the missing scope.",
          auth: {
            verifier: new ApiKeyTokenVerifier(apiKeyService, config),
            resource,
            authorizationServers: [
              config.get<string>("MCP_AUTHORIZATION_SERVER") ?? "http://localhost:8000",
            ],
            scopesSupported: [...MCP_SCOPES],
            resourceName: "Sanarwa",
          },
        };
      },
    }),
  ],
  providers: [SanarwaMcpTools],
})
export class SanarwaMcpModule {}
