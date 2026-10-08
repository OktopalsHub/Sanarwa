import { describe, expect, it, vi } from "vitest";
import { ForbiddenException } from "@nestjs/common";
import { ApiKeyAuthGuard } from "../api-key/guards/api-key-auth.guard";
import { MessagingController } from "./messaging.controller";

function createRedis(counts: number[]) {
  const commands: Array<{ name: string; args: unknown[] }> = [];
  return {
    pipeline() {
      return {
        incr(key: string) {
          commands.push({ name: "incr", args: [key] });
          return this;
        },
        expire(key: string, seconds: number) {
          commands.push({ name: "expire", args: [key, seconds] });
          return this;
        },
        exec: vi.fn(async () => counts.map((count) => [null, count] as [null, number])),
      };
    },
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
    const apiKeyService = {
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

    const tokenManagementService = {
      getBalance: vi.fn().mockResolvedValue({
        availableTokens: 100,
        totalTokens: 1000,
      }),
    };

    const redis = createRedis([11, 1, 1]);
    const guard = new ApiKeyAuthGuard(
      apiKeyService as never,
      tokenManagementService as never,
      redis as never,
    );

    const request = {
      headers: { "x-api-key": "secret" },
      query: { api_key: "attacker-key" },
      method: "POST",
      path: "/messaging/send",
      ip: "127.0.0.2",
      connection: { remoteAddress: "127.0.0.2" },
      socket: { remoteAddress: "127.0.0.2" },
    };

    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => request }),
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(apiKeyService.validateApiKey).toHaveBeenCalledWith(
      "secret",
      undefined,
      "127.0.0.2",
    );
  });
});
