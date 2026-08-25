import { BadRequestException } from "@nestjs/common";
import { Tenant } from "../../tenant/entities/tenant.entity";
import {
  BulkNotificationRequestDto,
  NotificationRequestDto,
} from "../dto/notification-request.dto";
import {
  BulkNotificationResponseDto,
  NotificationResponseDto,
  NotificationStatusDto,
} from "../dto/notification-response.dto";
import { DeliveryStatus } from "../notification-delivery.entity";
import { NotificationController } from "../notification.controller";
import { NotificationChannel, NotificationStatus, Priority } from "../notification.entity";
import { NotificationService } from "../notification.service";

describe("NotificationController (Unit)", () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockTenant: Tenant = {
    id: "tenant-123",
    name: "Test Tenant",
    subdomain: "test-tenant",
    inviteCode: "ABC123",
    status: "active" as any,
    quotas: {
      notifications: {
        daily: 1000,
        monthly: 10000,
      },
      channels: {
        email: { daily: 500, monthly: 5000 },
        sms: { daily: 200, monthly: 2000 },
      },
    },
    members: [],
    projects: [],
    invites: [],
    brands: [],
    templates: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Tenant;

  const mockNotificationResponse: NotificationResponseDto = {
    id: "notification-123",
    status: "pending",
    createdAt: new Date(),
  };

  const mockNotificationService = {
    sendNotification: vi.fn(),
    sendBulkNotifications: vi.fn(),
    getNotificationStatus: vi.fn(),
    retry: vi.fn(),
    findAll: vi.fn(),
  };

  beforeEach(async () => {
    // Create a simple test module without guards for unit testing
    controller = new NotificationController(mockNotificationService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("sendNotification", () => {
    it("should send a notification successfully", async () => {
      const request: NotificationRequestDto = {
        to: "test@example.com",
        message: "Test message",
        subject: "Test Subject",
        channel: NotificationChannel.EMAIL,
        priority: Priority.NORMAL,
        metadata: { name: "John Doe" },
      };

      mockNotificationService.sendNotification.mockResolvedValue(mockNotificationResponse);

      const result = await controller.sendNotification(request);

      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockNotificationResponse);
    });

    it("should handle service errors", async () => {
      const request: NotificationRequestDto = {
        to: "test@example.com",
        message: "Test message",
        channel: NotificationChannel.EMAIL,
      };

      mockNotificationService.sendNotification.mockRejectedValue(
        new BadRequestException("Invalid request"),
      );

      await expect(controller.sendNotification(request)).rejects.toThrow(BadRequestException);
    });
  });

  describe("sendBulkNotifications", () => {
    it("should send bulk notifications successfully", async () => {
      const request: BulkNotificationRequestDto = {
        notifications: [
          {
            to: "test1@example.com",
            message: "Test message 1",
            channel: NotificationChannel.EMAIL,
          },
          {
            to: "+1234567890",
            message: "Test message 2",
            channel: NotificationChannel.SMS,
          },
        ],
      };

      const mockBulkResponse: BulkNotificationResponseDto = {
        total: 2,
        successful: 1,
        failed: 1,
        results: [mockNotificationResponse],
      };

      mockNotificationService.sendBulkNotifications.mockResolvedValue(mockBulkResponse);

      const result = await controller.sendBulkNotifications(request);

      expect(mockNotificationService.sendBulkNotifications).toHaveBeenCalledWith(request);
      expect(result).toEqual(mockBulkResponse);
    });
  });

  describe("getStatus", () => {
    it("should get notification status successfully", async () => {
      const notificationId = "notification-123";
      const mockStatusResponse: NotificationStatusDto = {
        id: notificationId,
        status: DeliveryStatus.DELIVERED,
        updatedAt: new Date(),
        retryCount: 0,
      };

      mockNotificationService.getNotificationStatus.mockResolvedValue(mockStatusResponse);

      const result = await controller.getStatus(notificationId, "tenant-123");

      expect(result).toEqual(mockStatusResponse);
      expect(mockNotificationService.getNotificationStatus).toHaveBeenCalledWith(
        notificationId,
        "tenant-123",
      );
    });
  });
});
