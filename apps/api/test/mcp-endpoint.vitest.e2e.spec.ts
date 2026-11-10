import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AppModule } from "../src/app.module";
import { API_PREFIX, UNVERSIONED_PATHS } from "../src/common/http/api-prefix";

describe("MCP endpoint (boot smoke)", () => {
  let app: NestExpressApplication;
  let baseUrl: string;

  beforeAll(async () => {
    try {
      app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bodyParser: false,
        logger: ["error", "warn", "log"],
      });
      app.useBodyParser("json", { limit: "1mb" });
      app.useGlobalPipes(
        new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
      );
      app.setGlobalPrefix(API_PREFIX, { exclude: UNVERSIONED_PATHS });
      await app.listen(0);
      baseUrl = await app.getUrl();
    } catch (error) {
      console.error("BOOT FAILED:", error);
      throw error;
    }
  }, 600_000);

  afterAll(async () => {
    await app?.close();
  });

  it("answers 401 with an OAuth challenge on /mcp without a token", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate") ?? "").toContain("resource_metadata=");
  }, 30_000);

  it("refuses a bogus bearer token", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: "Bearer sa_not_a_real_key",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    expect(response.status).toBe(401);
  }, 30_000);

  it("serves the protected resource metadata at the root, not under /api/v1", async () => {
    const response = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);

    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.resource).toBe("http://localhost/mcp");
    expect(body.authorization_servers).toEqual(["http://localhost/auth"]);
    expect(body.scopes_supported).toEqual(expect.arrayContaining(["billing:read"]));

    const prefixed = await fetch(`${baseUrl}/api/v1/.well-known/oauth-protected-resource/mcp`);
    expect(prefixed.status).toBe(404);
  }, 30_000);

  it("does not serve /mcp under the versioned prefix", async () => {
    const response = await fetch(`${baseUrl}/api/v1/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    expect(response.status).toBe(404);
  }, 30_000);
});
