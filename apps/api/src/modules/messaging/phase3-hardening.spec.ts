import {
  ForbiddenException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ApiKeyAuthGuard } from "../api-key/guards/api-key-auth.guard";
import { MessagingController } from "./messaging.controller";

function createRedis(results: number[]) {
  const evalMock = vi.fn();
  for (const result of results) {
    evalMock.mockResolvedValueOnce(result);
  }

  return {
    eval: evalMock,
  };
}

function createApiKeyService() {
  return {
    validateApiKey: vi.fn().mockResolvedValue({
      id: "key-1",
      keyPrefix: "snr_",
      projectId: "project-1",
      tenantId: "tenant-1",
      permissions: ["*"],
      environment: "production",
      isExpired: false,
      status: "active",
      rateLimitPerMinute: 10,
      rateLimitPerHour: 100,
      rateLimitPerDay: 1000,
      ipWhitelist: [],
    }),
  };
}

function createTokenManagementService() {
  return {
    getBalance: vi.fn().mockResolvedValue({
      availableTokens: 100,
      totalTokens: 1000,
    }),
  };
}

function createRequest() {
  return {
    headers: { "x-api-key": "secret" },
    query: { api_key: "attacker-key" },
    method: "POST",
    path: "/messaging/send",
    ip: "127.0.0.2",
    connection: { remoteAddress: "127.0.0.2" },
    socket: { remoteAddress: "127.0.0.2" },
  };
}

describe("Phase 3 hardening", () => {
  it("binds messaging requests to API-key tenant and project", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ status: "delivered" });
    const controller = new MessagingController({ sendMessage } as never);

    await controller.sendMessage(
      {
        channels: ["email"],
        recipients: [{ id: "recipient", email: "user@example.com" }],
        content: "hello",
        metadata: { projectId: "attacker-project" },
      } as never,
      { apiKey: { tenantId: "tenant-1", projectId: "project-1" } },
    );

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ projectId: "project-1" }),
      }),
      "tenant-1",
    );
  });

  it("rejects an API key that exceeds its configured minute limit", async () => {
    const apiKeyService = createApiKeyService();
    const redis = createRedis([11]);
    const guard = new ApiKeyAuthGuard(
      apiKeyService as never,
      createTokenManagementService() as never,
      redis as never,
    );

    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => createRequest() }),
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(apiKeyService.validateApiKey).toHaveBeenCalledWith(
      "secret",
      undefined,
      "127.0.0.2",
    );
  });

  it("uses fixed expiry windows instead of resetting expiry on every request", async () => {
    const apiKeyService = createApiKeyService();
    const redis = createRedis([1, 1, 1]);
    const guard = new ApiKeyAuthGuard(
      apiKeyService as never,
      createTokenManagementService() as never,
      redis as never,
    );

    await guard.canActivate({
      switchToHttp: () => ({ getRequest: () => createRequest() }),
    } as never);

    expect(redis.eval).toHaveBeenCalledTimes(3);

    const [script, keyCount, minuteKey, minuteSeconds] = redis.eval.mock.calls[0];
    expect(keyCount).toBe(1);
    expect(minuteKey).toBe("sanarwa:api-key-rate:key-1:minute");
    expect(minuteSeconds).toBe(60);
    expect(script).toContain(
      "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end;",
    );

    expect(redis.eval.mock.calls[1][3]).toBe(3600);
    expect(redis.eval.mock.calls[2][3]).toBe(86400);
  });

  it("fails closed when Redis is unavailable", async () => {
    const apiKeyService = createApiKeyService();
    const guard = new ApiKeyAuthGuard(
      apiKeyService as never,
      createTokenManagementService() as never,
    );

    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => createRequest() }),
      } as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
