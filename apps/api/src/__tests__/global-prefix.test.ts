import { Controller, Get, Module, RequestMethod } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { API_PREFIX, UNVERSIONED_PATHS } from "../common/http/api-prefix";
import { createSwaggerConfig } from "../config/swagger.config";

@Controller("tenants")
class ProductProbeController {
  @Get("me")
  me() {
    return { ok: true };
  }
}

@Module({ controllers: [ProductProbeController] })
class ProbeModule {}

async function probe(exclude: Array<{ path: string; method: RequestMethod }>) {
  const app = await NestFactory.create(ProbeModule, { logger: false });
  app.setGlobalPrefix(API_PREFIX, { exclude });
  await app.listen(0);

  const port = (app.getHttpServer() as { address(): { port: number } }).address().port;
  const status = async (path: string) => (await fetch(`http://127.0.0.1:${port}${path}`)).status;

  const result = {
    productBare: await status("/tenants/me"),
    productPrefixed: await status("/api/v1/tenants/me"),
  };

  await app.close();
  return result;
}

describe("global prefix exclusions", () => {
  it("keeps product routes behind the api/v1 prefix", async () => {
    const result = await probe(UNVERSIONED_PATHS);

    expect(result.productBare).toBe(404);
    expect(result.productPrefixed).toBe(200);
  });
});

describe("api prefix hygiene", () => {
  it("uses exactly one api segment", () => {
    expect(API_PREFIX).toBe("api/v1");
    expect(API_PREFIX.match(/\bapi\b/gi)).toHaveLength(1);
  });

  it("every swagger server carries the prefix exactly once", () => {
    // createSwaggerConfig() ends the builder chain with .build(), so it returns the config.
    const servers = (createSwaggerConfig().servers ?? []).map((s) => s.url);

    expect(servers.length).toBeGreaterThan(0);

    for (const url of servers) {
      expect(url, `${url} must end with /${API_PREFIX}`).toMatch(new RegExp(`/${API_PREFIX}$`));
      expect(url, `${url} must not repeat the api segment`).not.toContain("/api/api/");
      expect(url.endsWith("//")).toBe(false);
    }
  });
});
