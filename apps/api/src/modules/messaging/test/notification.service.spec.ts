import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { NotificationRequestDto } from "../dto/notification-request.dto";
import { NotificationService } from "../notification.service";

vi.mock("../../notifications/entities/notification-log.entity", () => ({
  NotificationLog: class NotificationLog {},
}));

vi.mock("../../api-key/entities/api-key.entity", () => ({
  ApiKey: class ApiKey {},
}));

describe("NotificationService", () => {
  let service: NotificationService;

  const apiKey = {
    id: "key-1",
    projectId: "project-1",
    tenantId: "tenant-1",
  } as unknown as ApiKey;

  const request = (overrides: Partial<NotificationRequestDto> = {}): NotificationRequestDto =>
    ({
      to: "user@example.com",
      channel: NotificationChannel.EMAIL,
      message: "hello there",
      ...overrides,
    }) as NotificationRequestDto;

  let engine: { send: ReturnType<typeof vi.fn> };
  let logs: { findOne: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    engine = { send: vi.fn() };
    logs = { findOne: vi.fn() };
    service = new NotificationService(engine as never, logs as never);
  });

  describe("sendNotification", () => {
    it("derives tenant and project scope from the API key", async () => {
      engine.send.mockResolvedValue({ id: "log-1", status: "queued" });

      await service.sendNotification(request(), apiKey);

      expect(engine.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "tenant-1",
          projectId: "project-1",
          channel: "email",
          to: "user@example.com",
          message: "hello there",
        }),
      );
    });

    it("reports the engine outcome rather than a claimed success", async () => {
      engine.send.mockResolvedValue({
        id: "log-2",
        status: "failed",
        error: "provider rejected",
      });

      const result = await service.sendNotification(request(), apiKey);

      expect(result.id).toBe("log-2");
      expect(result.status).toBe("failed");
      expect(result.error).toBe("provider rejected");
    });

    it("succeeds when the engine reports the message sent", async () => {
      engine.send.mockResolvedValue({ id: "log-3", status: "sent" });

      const result = await service.sendNotification(request(), apiKey);

      expect(result.status).toBe("sent");
    });

    it("rejects a request with neither message nor template", async () => {
      const { message: _message, ...withoutContent } = request();

      await expect(
        service.sendNotification(withoutContent as NotificationRequestDto, apiKey),
      ).rejects.toThrow(BadRequestException);
      expect(engine.send).not.toHaveBeenCalled();
    });

    it("rejects a key that resolves to no tenant instead of sending anyway", async () => {
      const keyless = { projectId: "project-1", tenantId: undefined } as unknown as ApiKey;

      await expect(service.sendNotification(request(), keyless)).rejects.toThrow(
        BadRequestException,
      );
      expect(engine.send).not.toHaveBeenCalled();
    });

    it("rejects a channel the engine cannot deliver", async () => {
      await expect(
        service.sendNotification(request({ channel: NotificationChannel.VOICE }), apiKey),
      ).rejects.toThrow(BadRequestException);
      expect(engine.send).not.toHaveBeenCalled();
    });
  });

  describe("sendBulkNotifications", () => {
    it("counts failures from real outcomes", async () => {
      engine.send
        .mockResolvedValueOnce({ id: "a", status: "sent" })
        .mockRejectedValueOnce(new Error("provider down"))
        .mockResolvedValueOnce({ id: "c", status: "failed", error: "bad address" });

      const result = await service.sendBulkNotifications(
        {
          notifications: [
            request({ to: "a@x.com" }),
            request({ to: "b@x.com" }),
            request({ to: "c@x.com" }),
          ],
        } as never,
        apiKey,
      );

      expect(result.total).toBe(3);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(2);
      expect(result.results[1].error).toBe("provider down");
    });
  });

  describe("getNotificationStatus", () => {
    it("scopes the lookup to the tenant", async () => {
      logs.findOne.mockResolvedValue({
        id: "log-9",
        status: "delivered",
        createdAt: new Date("2026-01-01"),
      });

      const result = await service.getNotificationStatus("log-9", "tenant-1");

      expect(logs.findOne).toHaveBeenCalledWith({ where: { id: "log-9", tenantId: "tenant-1" } });
      expect(result.status).toBe("delivered");
    });

    it("reports an unknown notification as not found", async () => {
      logs.findOne.mockResolvedValue(null);

      await expect(service.getNotificationStatus("nope", "tenant-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
