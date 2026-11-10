import { ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { McpModule } from "@nestjs/mcp";
import { Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Client, InsufficientScopeError } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { API_PREFIX, UNVERSIONED_PATHS } from "../../../common/http/api-prefix";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiKeyTokenVerifier } from "../api-key-token.verifier";
import { Public } from "../../auth/decorators/public.decorator";
import { MCP_SCOPES } from "../mcp-scopes";
import { SanarwaMcpTools } from "../mcp.tools";
import { AnalyticsService } from "../../analytics/analytics.service";
import { MessagingService } from "../../messaging/messaging.service";
import { TokenManagementService } from "../../token-management/services/token-management.service";

const sendToken = "send-token";
const readOnlyToken = "read-token";

const sendTokenPermissions = {
  id: "key_1",
  keyPrefix: "sa_12345678",
  referenceId: "tenant-1",
  permissions: ["billing:read", "notifications:send"],
  environment: "production" as const,
  status: "active" as const,
  isActive: true,
  isExpired: false,
  projectId: "project-1",
  tenantId: "tenant-1",
};

const readOnlyTokenPermissions = {
  ...sendTokenPermissions,
  permissions: ["billing:read"],
};

const validateApiKey = vi.fn(async (key: string) => {
  if (key === sendToken) return sendTokenPermissions;
  if (key === readOnlyToken) return readOnlyTokenPermissions;
  return null;
});

const fakeApiKeyService = { validateApiKey } as never;

const getBalance = vi.fn(async () => ({
  availableTokens: 2988,
  usedTokens: 12,
  grantedTokens: 3000,
  reservedTokens: 0,
}));

const sendMessage = vi.fn(async () => ({
  id: "msg_test_1",
  status: "queued",
  scheduledAt: null,
  channel: "sms",
  recipientCount: 1,
}));

const getTenantAnalytics = vi.fn(async () => ({
  period: "30d",
  scheduled: 0,
  delivered: 0,
  failed: 0,
  pending: 0,
  deliveryRate: null,
}));

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    McpModule.forRootAsync({
      path: "mcp",
      decorators: [Public()],
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const resource = config.get<string>("MCP_RESOURCE") ?? "http://localhost:3000/mcp";
        return {
          name: "sanarwa",
          version: "0.0.1",
          instructions:
            "Sanarwa test harness. Check get-token-balance before a send: sends spend tokens.",
          auth: {
            verifier: new ApiKeyTokenVerifier(fakeApiKeyService, config),
            resource,
            authorizationServers: [
              config.get<string>("MCP_AUTHORIZATION_SERVER") ?? "http://localhost:3000",
            ],
            resourceName: "Sanarwa",
            scopesSupported: [...MCP_SCOPES],
          },
        };
      },
    }),
  ],
  providers: [
    SanarwaMcpTools,
    { provide: TokenManagementService, useValue: { getBalance } },
    { provide: AnalyticsService, useValue: { getTenantAnalytics } },
    { provide: MessagingService, useValue: { sendMessage } },
  ],
})
class TestMcpModule {}

describe("sanarwa MCP server", () => {
  let app: NestExpressApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestMcpModule],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    app.useBodyParser("json", { limit: "1mb" });
    app.setGlobalPrefix(API_PREFIX, { exclude: UNVERSIONED_PATHS });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0);
    baseUrl = await app.getUrl();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  async function connect(token: string): Promise<Client> {
    const url = new URL(`${baseUrl}/mcp`);
    const client = new Client({ name: "sanarwa-test", version: "0.0.1" });

    await client.connect(
      new StreamableHTTPClientTransport(url, { authProvider: { token: async () => token } }),
    );

    return client;
  }

  it("reads the token balance for a billing:read token", async () => {
    const client = await connect(sendToken);

    try {
      const result = await client.callTool({ name: "get-token-balance", arguments: {} });

      expect(getBalance).toHaveBeenCalledWith("tenant-1");
      expect(JSON.parse((result.content as { text: string }[])[0].text)).toMatchObject({
        availableTokens: 2988,
      });
    } finally {
      await client.close();
    }
  });

  it("answers a send call with insufficient scope when the token lacks it", async () => {
    const client = await connect(readOnlyToken);

    try {
      const error = await client
        .callTool({
          name: "send-notification",
          arguments: {
            channels: ["sms"],
            recipients: [{ id: "user-1", phone: "+15551234567" }],
            variables: { name: "Ada" },
            data: "Your code is 123456",
          },
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(InsufficientScopeError);
      expect(error).toMatchObject({ requiredScope: "notifications:send" });
      expect(sendMessage).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });

  it("sends for a notifications:send token with the project in metadata", async () => {
    const client = await connect(sendToken);

    try {
      const result = await client.callTool({
        name: "send-notification",
        arguments: {
          channels: ["sms"],
          recipients: [{ id: "user-1", phone: "+15551234567" }],
          variables: { name: "Ada" },
          data: "Your code is 123456",
        },
      });

      expect(result.isError).toBeFalsy();
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channels: ["sms"],
          metadata: expect.objectContaining({ projectId: "project-1" }),
        }),
        "tenant-1",
      );
    } finally {
      await client.close();
    }
  });
});
