import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SMSService } from "../services/sms.service";
import { SMSConversationService } from "../services/sms-conversation.service";
import { SmartSMSRouterService } from "../services/smart-sms-router.service";
import { TwilioProvider } from "../providers/sms/providers/twilio.provider";
import { TermiiProvider } from "../providers/sms/providers/termii.provider";
import { TelnyxProvider } from "../providers/sms/providers/telnyx.provider";
import { InfobipProvider } from "../providers/sms/providers/infobip.provider";
import {
  Message,
  MessageChannel,
  MessageStatus,
  MessagePriority,
} from "../../messaging/message.entity";
import { MessageDelivery, MessageDeliveryStatus } from "../../messaging/message-delivery.entity";
import type { Mock } from "vitest";

describe("SMS Conversation Integration", () => {
  let smsService: SMSService;
  let conversationService: SMSConversationService;
  let smartRouter: SmartSMSRouterService;
  let messageRepository: Repository<Message>;
  let deliveryRepository: Repository<MessageDelivery>;
  let eventEmitter: EventEmitter2;

  const mockMessageRepository = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const mockDeliveryRepository = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
  };

  const mockEventEmitter = {
    emit: vi.fn(),
  };

  const mockSmartRouter = {
    selectProvider: vi.fn(),
  };

  const mockTwilioProvider = {
    sendSMS: vi.fn(),
    validateConfig: vi.fn(),
    getProviderName: () => "twilio",
    getSupportedCountries: () => ["US", "CA"],
    getCostPerMessage: () => 0.0075,
  };

  const mockTermiiProvider = {
    sendSMS: vi.fn(),
    validateConfig: vi.fn(),
    getProviderName: () => "termii",
    getSupportedCountries: () => ["NG", "GH"],
    getCostPerMessage: () => 0.015,
  };

  const mockTelnyxProvider = {
    sendSMS: vi.fn(),
    validateConfig: vi.fn(),
    getProviderName: () => "telnyx",
    getSupportedCountries: () => ["US", "CA", "NG"],
    getCostPerMessage: () => 0.004,
  };

  const mockInfobipProvider = {
    sendSMS: vi.fn(),
    validateConfig: vi.fn(),
    getProviderName: () => "infobip",
    getSupportedCountries: () => ["GB", "DE", "FR"],
    getCostPerMessage: () => 0.035,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SMSService,
        SMSConversationService,
        {
          provide: SmartSMSRouterService,
          useValue: mockSmartRouter,
        },
        {
          provide: getRepositoryToken(Message),
          useValue: mockMessageRepository,
        },
        {
          provide: getRepositoryToken(MessageDelivery),
          useValue: mockDeliveryRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: TwilioProvider,
          useValue: mockTwilioProvider,
        },
        {
          provide: TermiiProvider,
          useValue: mockTermiiProvider,
        },
        {
          provide: TelnyxProvider,
          useValue: mockTelnyxProvider,
        },
        {
          provide: InfobipProvider,
          useValue: mockInfobipProvider,
        },
      ],
    }).compile();

    smsService = module.get<SMSService>(SMSService);
    conversationService = module.get<SMSConversationService>(SMSConversationService);
    smartRouter = module.get<SmartSMSRouterService>(SmartSMSRouterService);
    messageRepository = module.get<Repository<Message>>(getRepositoryToken(Message));
    deliveryRepository = module.get<Repository<MessageDelivery>>(
      getRepositoryToken(MessageDelivery),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Reset mocks
    vi.clearAllMocks();
  });

  describe("Bidirectional SMS Flow", () => {
    it("should maintain provider continuity in conversations", async () => {
      // Setup: Mock routing to select Termii for Nigerian number
      mockSmartRouter.selectProvider.mockResolvedValue({
        providerId: "termii",
        providerName: "Termii",
        region: "Nigeria",
        costPerSMS: 0.015,
        isOptimal: true,
      });

      // Setup: Mock Termii provider success
      mockTermiiProvider.sendSMS.mockResolvedValue({
        success: true,
        messageId: "termii_msg_123",
        cost: 0.015,
        provider: "termii",
      });

      // Setup: Mock message creation
      const mockMessage = {
        id: "msg_123",
        tenantId: "tenant-123",
        channels: [MessageChannel.SMS],
        recipients: [{ id: "sms_123", phone: "+234801234567" }],
        status: MessageStatus.SENT,
        metadata: {
          provider: "termii",
          conversationId: "termii_234801234567",
          direction: "outbound",
        },
        createdAt: new Date(),
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockDeliveryRepository.create.mockReturnValue({});
      mockDeliveryRepository.save.mockResolvedValue({});

      // Step 1: Send initial SMS
      const result = await smsService.sendSMS({
        to: "+234801234567",
        message: "Hello! Your order #12345 has been confirmed.",
        tenantId: "tenant-123",
        metadata: { orderId: "12345" },
      });

      // Verify initial SMS was sent via Termii
      expect(result.success).toBe(true);
      expect(result.provider).toBe("termii");
      expect(mockTermiiProvider.sendSMS).toHaveBeenCalledWith({
        to: "+234801234567",
        message: "Hello! Your order #12345 has been confirmed.",
        metadata: { orderId: "12345" },
      });

      // Step 2: Simulate inbound reply
      const inboundPayload = {
        messageId: "termii_inbound_456",
        from: "+234801234567",
        to: "+234700000000",
        text: "What is the delivery time?",
        timestamp: new Date(),
        provider: "termii",
        metadata: {
          conversationId: "termii_234801234567",
        },
      };

      // Setup: Mock finding original message for conversation context
      mockMessageRepository.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockMessage),
      });

      // Process inbound message
      await smsService.handleInboundSMS(inboundPayload);

      // Verify conversation event was emitted
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("sms.conversation.reply", {
        inboundMessage: inboundPayload,
        originalMessage: mockMessage,
        conversationId: "termii_234801234567",
        provider: "termii",
      });

      // Step 3: Send reply using conversation service
      mockSmartRouter.selectProvider.mockResolvedValue({
        providerId: "termii", // Should prefer Termii for conversation continuity
        providerName: "Termii",
        region: "Nigeria",
        costPerSMS: 0.015,
        isOptimal: true,
      });

      const replyResult = await conversationService.sendConversationMessage(
        "termii_234801234567",
        "Your order will be delivered within 2-3 business days.",
        "tenant-123",
      );

      // Verify reply was sent via same provider (Termii)
      expect(replyResult.success).toBe(true);
      expect(mockTermiiProvider.sendSMS).toHaveBeenCalledTimes(2); // Initial + reply
      expect(mockSmartRouter.selectProvider).toHaveBeenCalledWith(
        "+234801234567",
        "termii", // Preferred provider for conversation continuity
      );
    });

    it("should handle provider failover while maintaining conversation context", async () => {
      // Setup: Termii is initially healthy
      mockSmartRouter.selectProvider.mockResolvedValueOnce({
        providerId: "termii",
        providerName: "Termii",
        region: "Nigeria",
        costPerSMS: 0.015,
        isOptimal: true,
      });

      mockTermiiProvider.sendSMS.mockResolvedValue({
        success: true,
        messageId: "termii_msg_123",
        cost: 0.015,
        provider: "termii",
      });

      // Setup message mocks
      const mockMessage = {
        id: "msg_123",
        tenantId: "tenant-123",
        metadata: { provider: "termii", conversationId: "termii_234801234567" },
        recipients: [{ phone: "+234801234567" }],
        createdAt: new Date(),
      };

      mockMessageRepository.create.mockReturnValue(mockMessage);
      mockMessageRepository.save.mockResolvedValue(mockMessage);
      mockDeliveryRepository.create.mockReturnValue({});
      mockDeliveryRepository.save.mockResolvedValue({});

      // Send initial message via Termii
      await smsService.sendSMS({
        to: "+234801234567",
        message: "Initial message",
        tenantId: "tenant-123",
      });

      // Setup: Termii becomes unhealthy, fallback to Telnyx
      mockSmartRouter.selectProvider.mockResolvedValueOnce({
        providerId: "telnyx",
        providerName: "Telnyx",
        region: "Nigeria",
        costPerSMS: 0.025,
        isOptimal: false, // Fallback provider
      });

      mockTelnyxProvider.sendSMS.mockResolvedValue({
        success: true,
        messageId: "telnyx_msg_456",
        cost: 0.025,
        provider: "telnyx",
      });

      // Setup conversation context lookup
      mockMessageRepository.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockMessage),
      });

      // Try to send reply - should attempt Termii first, then fallback to Telnyx
      const replyResult = await conversationService.sendConversationMessage(
        "termii_234801234567",
        "Fallback reply message",
        "tenant-123",
      );

      // Verify fallback occurred
      expect(replyResult.success).toBe(true);
      expect(mockSmartRouter.selectProvider).toHaveBeenCalledWith(
        "+234801234567",
        "termii", // Still tries preferred provider first
      );
    });

    it("should handle auto-replies correctly", async () => {
      // Setup conversation context
      const mockMessage = {
        id: "msg_123",
        tenantId: "tenant-123",
        metadata: { provider: "termii", conversationId: "termii_234801234567" },
        recipients: [{ phone: "+234801234567" }],
        createdAt: new Date(),
      };

      mockMessageRepository.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockMessage),
      });

      mockSmartRouter.selectProvider.mockResolvedValue({
        providerId: "termii",
        providerName: "Termii",
        region: "Nigeria",
        costPerSMS: 0.015,
        isOptimal: true,
      });

      mockTermiiProvider.sendSMS.mockResolvedValue({
        success: true,
        messageId: "termii_auto_reply",
        cost: 0.015,
        provider: "termii",
      });

      mockMessageRepository.create.mockReturnValue({});
      mockMessageRepository.save.mockResolvedValue({});
      mockDeliveryRepository.create.mockReturnValue({});
      mockDeliveryRepository.save.mockResolvedValue({});

      // Simulate "HELP" keyword
      const helpPayload = {
        messageId: "termii_inbound_help",
        from: "+234801234567",
        to: "+234700000000",
        text: "HELP",
        timestamp: new Date(),
        provider: "termii",
        metadata: {},
      };

      await smsService.handleInboundSMS(helpPayload);

      // Verify auto-reply was sent
      expect(mockTermiiProvider.sendSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+234801234567",
          message: expect.stringContaining("STATUS for order updates"),
        }),
      );
    });
  });

  describe("Conversation Analytics", () => {
    it("should track conversation metrics correctly", async () => {
      // Setup mock query builder for analytics
      const mockQueryBuilder = {
        createQueryBuilder: vi.fn().mockReturnValue({
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getMany: vi.fn().mockResolvedValue([
            {
              id: "msg_1",
              tenantId: "tenant-123",
              channels: [MessageChannel.SMS],
              recipients: [{ phone: "+234801234567" }],
              deliveries: [{ status: MessageDeliveryStatus.DELIVERED }],
              metadata: {
                provider: "termii",
                direction: "outbound",
                cost: 0.015,
              },
              createdAt: new Date(),
            },
            {
              id: "msg_2",
              tenantId: "tenant-123",
              channels: [MessageChannel.SMS],
              recipients: [{ phone: "+234801234567" }],
              deliveries: [{ status: MessageDeliveryStatus.DELIVERED }],
              metadata: {
                provider: "termii",
                direction: "inbound",
              },
              createdAt: new Date(),
            },
          ]),
        }),
      };

      mockMessageRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder.createQueryBuilder(),
      );

      const analytics = await smsService.getSMSAnalytics(
        "tenant-123",
        new Date("2024-01-01"),
        new Date("2024-01-31"),
      );

      expect(analytics.totalSent).toBe(1);
      expect(analytics.totalReceived).toBe(1);
      expect(analytics.deliveryRate).toBe(100);
      expect(analytics.totalCost).toBe(0.015);
      expect(analytics.providerBreakdown.termii).toBe(1);
    });
  });
});
