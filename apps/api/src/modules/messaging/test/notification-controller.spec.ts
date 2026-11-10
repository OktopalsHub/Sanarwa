import { Test, TestingModule } from "@nestjs/testing";
import { Tenant } from "../../tenant/entities/tenant.entity";
import { ApiKeyVerificationService } from "../../api-key/api-key-verification.service";
import { MessagingController } from "../messaging.controller";
import { MessagePriority, MessageStatus } from "../message.entity";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { MessagingService } from "../messaging.service";

describe("MessagingController", () => {
  let controller: MessagingController;
  let service: MessagingService;

  const mockTenant = {
    id: "tenant-1",
    name: "Test Tenant",
    subdomain: "test-tenant",
    inviteCode: "ABC123",
    status: "active" as any,
    quotas: {
      notifications: {
        daily: 1000,
        monthly: 30000,
      },
      channels: {
        email: { daily: 500, monthly: 15000 },
        sms: { daily: 200, monthly: 6000 },
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    projects: [],
    invites: [],
    brands: [],
    templates: [],
  } as Tenant;

  const mockMessagingService = {
    sendMessage: vi.fn(),
    sendBulkMessages: vi.fn(),
    getMessageStatus: vi.fn(),
    getDeliveryReports: vi.fn(),
    getTenantMessages: vi.fn(),
    cancelMessage: vi.fn(),
    getDeliveryStats: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [
        {
          provide: MessagingService,
          useValue: mockMessagingService,
        },
        {
          provide: ApiKeyVerificationService,
          useValue: { verify: vi.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    controller = module.get<MessagingController>(MessagingController);
    service = module.get<MessagingService>(MessagingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /notifications", () => {
    it("should send a notification successfully", async () => {
      const request = {
        tenantId: "original-tenant-id",
        channels: [NotificationChannel.EMAIL],
        recipients: [
          {
            id: "recipient-1",
            email: "test@example.com",
          },
        ],
        data: { name: "John Doe" },
        priority: MessagePriority.NORMAL,
        subject: "Test Subject",

        data: "Test Content",
      };

      const expectedResponse = {
        id: "message-1",
        tenantId: mockTenant.id,
        channels: [NotificationChannel.EMAIL],
        status: MessageStatus.PENDING,
        priority: MessagePriority.NORMAL,
        subject: "Test Subject",

        data: "Test Content",
        deliveries: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMessagingService.sendMessage.mockResolvedValue(expectedResponse);

      const req = { apiKey: { tenantId: "tenant-1", projectId: "project-1" } };
      const result = await controller.sendMessage(request, req);

      expect(mockMessagingService.sendMessage).toHaveBeenCalledWith(
        {
          ...request,
          metadata: { ...request.metadata, projectId: "project-1" },
        },
        "tenant-1",
        undefined,
      );
      expect(result).toEqual(expectedResponse);
    });

    it("should override tenantId with authenticated tenant ID for security", async () => {
      const request = {
        tenantId: "malicious-tenant-id",
        channels: [NotificationChannel.EMAIL],
        recipients: [
          {
            id: "recipient-1",
            email: "test@example.com",
          },
        ],
        data: { name: "John Doe" },
      };

      mockMessagingService.sendMessage.mockResolvedValue({});

      const req = { apiKey: { tenantId: "tenant-1", projectId: "project-1" } };
      await controller.sendMessage(request, req);

      // The API key's tenant wins over anything in the body.
      expect(mockMessagingService.sendMessage).toHaveBeenCalledWith(
        {
          ...request,
          metadata: { ...request.metadata, projectId: "project-1" },
        },
        "tenant-1",
        undefined,
      );
    });
  });

  describe("POST /notifications/bulk", () => {
    it("should send bulk notifications successfully", async () => {
      const request = {
        messages: [
          {
            tenantId: "original-tenant-id-1",
            channels: [NotificationChannel.EMAIL],
            recipients: [
              {
                id: "recipient-1",
                email: "test1@example.com",
              },
            ],
            data: { name: "John Doe" },
            subject: "Bulk Test 1",
          },
          {
            tenantId: "original-tenant-id-2",
            channels: [NotificationChannel.SMS],
            recipients: [
              {
                id: "recipient-2",
                phone: "+1234567890",
              },
            ],
            data: { name: "Jane Doe" },

            data: "Bulk SMS Test",
          },
        ],
      };

      const expectedResponse = {
        successful: [],
        failed: [],
        totalProcessed: 2,
        successCount: 2,
        failureCount: 0,
      };

      mockMessagingService.sendBulkMessages.mockResolvedValue(expectedResponse);

      const req = { apiKey: { tenantId: "tenant-1", projectId: "project-1" } };
      const result = await controller.sendBulkMessages(request, req);

      expect(mockMessagingService.sendBulkMessages).toHaveBeenCalledWith(
        {
          ...request,
          messages: request.messages.map((message: Record<string, unknown>) => ({
            ...message,
            metadata: {
              ...((message.metadata as Record<string, unknown>) ?? {}),
              projectId: "project-1",
            },
          })),
        },
        "tenant-1",
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("GET /notifications/:id/status", () => {
    it("should get notification status successfully", async () => {
      const notificationId = "notification-1";
      const expectedStatus = {
        id: notificationId,
        status: MessageStatus.SENT,
        deliveries: [],
        updatedAt: new Date(),
      };

      mockMessagingService.getMessageStatus.mockResolvedValue(expectedStatus);

      const result = await controller.getMessageStatus(notificationId, mockTenant.id);

      expect(mockMessagingService.getMessageStatus).toHaveBeenCalledWith(
        notificationId,
        mockTenant.id,
      );
      expect(result).toEqual(expectedStatus);
    });
  });

  describe("DELETE /messaging/:id", () => {
    it("should cancel a scheduled message successfully", async () => {
      const messageId = "message-1";
      const expectedResponse = {
        id: messageId,
        tenantId: mockTenant.id,
        status: MessageStatus.CANCELLED,
        updatedAt: new Date(),
      };

      mockMessagingService.cancelMessage.mockResolvedValue(expectedResponse);

      const result = await controller.cancelMessage(messageId, mockTenant.id);

      expect(mockMessagingService.cancelMessage).toHaveBeenCalledWith(messageId, mockTenant.id);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("GET /messaging", () => {
    it("should get notifications with pagination and filtering", async () => {
      const query = {
        page: 1,
        limit: 10,
        status: MessageStatus.SENT,
        tenantId: "original-tenant-id",
      };

      const expectedResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };

      mockMessagingService.getTenantMessages.mockResolvedValue(expectedResponse);

      const result = await controller.getMessages(query, mockTenant.id);

      expect(mockMessagingService.getTenantMessages).toHaveBeenCalledWith(query, mockTenant.id);
      expect(result).toEqual(expectedResponse);
    });
  });
});
