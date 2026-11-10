import { describe, expect, it } from "vitest";
import { ConfigError, resolveConfig } from "../config.js";

describe("resolveConfig", () => {
  it("requires an API key", () => {
    expect(() => resolveConfig({})).toThrow(ConfigError);
  });

  it("defaults the base URL, host and port", () => {
    const config = resolveConfig({ SANARWA_API_KEY: "nk_live_abc" });

    expect(config).toEqual({
      apiKey: "nk_live_abc",
      baseUrl: "https://api.sanarwa.com/api/v1",
      host: "127.0.0.1",
      port: 3400,
    });
  });

  it("honours overrides", () => {
    const config = resolveConfig({
      SANARWA_API_KEY: "nk_test_abc",
      SANARWA_BASE_URL: "http://localhost:3000/v1",
      SANARWA_MCP_PORT: "8080",
      SANARWA_MCP_HOST: "0.0.0.0",
    });

    expect(config.port).toBe(8080);
    expect(config.host).toBe("0.0.0.0");
    expect(config.baseUrl).toBe("http://localhost:3000/v1");
  });

  it("rejects a malformed base URL", () => {
    expect(() => resolveConfig({ SANARWA_API_KEY: "k", SANARWA_BASE_URL: "not-a-url" })).toThrow(
      ConfigError,
    );
  });
});
