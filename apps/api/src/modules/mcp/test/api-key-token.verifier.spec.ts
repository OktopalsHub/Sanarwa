import type { ConfigService } from "@nestjs/config";
import type { ApiKeyService } from "../../api-key/api-key.service";
import { ApiKeyTokenVerifier } from "../api-key-token.verifier";

const configWith = (env: Record<string, string>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService;

const apiKeyWith = (validateApiKey: unknown) => ({ validateApiKey }) as unknown as ApiKeyService;

const activeKey = {
  id: "key_1",
  keyPrefix: "sa_12345678",
  referenceId: "tenant-1",
  permissions: ["billing:read", "notifications:send"],
  environment: "production",
  status: "active",
  isActive: true,
  isExpired: false,
  projectId: "project-1",
  tenantId: "tenant-1",
};

describe("ApiKeyTokenVerifier", () => {
  it("returns null when the key does not validate", async () => {
    const verifier = new ApiKeyTokenVerifier(
      apiKeyWith(async () => null),
      configWith({}),
    );

    expect(await verifier.verifyAccessToken("sa_anything")).toBeNull();
  });

  it("maps permissions, tenant and project onto the token info", async () => {
    const verifier = new ApiKeyTokenVerifier(
      apiKeyWith(async () => activeKey),
      configWith({}),
    );

    const authInfo = await verifier.verifyAccessToken("sa_key");

    expect(authInfo).toMatchObject({
      token: "sa_key",
      clientId: "key_1",
      scopes: ["billing:read", "notifications:send"],
      extra: { tenantId: "tenant-1", projectId: "project-1" },
    });
    expect(authInfo?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(authInfo?.resource.toString()).toBe("http://localhost:8000/mcp");
  });

  it("passes no projectId through when the key carries none", async () => {
    const verifier = new ApiKeyTokenVerifier(
      apiKeyWith(async () => ({ ...activeKey, projectId: "" })),
      configWith({ MCP_RESOURCE: "https://api.example.com/mcp" }),
    );

    const authInfo = await verifier.verifyAccessToken("sa_key");

    expect(authInfo?.extra?.projectId).toBeUndefined();
    expect(authInfo?.resource.toString()).toBe("https://api.example.com/mcp");
  });
});
