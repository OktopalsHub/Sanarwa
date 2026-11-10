import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { AnalyticsService } from "../analytics.service";
import { Message } from "../../messaging/message.entity";
import { MessageDelivery } from "../../messaging/message-delivery.entity";
import { DeliveryEvent } from "../../messaging/entities/delivery-event.entity";
import { MessageStatus } from "../../messaging/message.entity";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import type { Mock, Mocked } from "vitest";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let notificationRepository: Mocked<Repository<Message>>;

  const notification = (status: MessageStatus, channel: NotificationChannel) =>
    ({ status, channels: [channel], createdAt: new Date() }) as Message;

  beforeEach(async () => {
    const mockRepository = {
      createQueryBuilder: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Message), useValue: mockRepository },
        { provide: getRepositoryToken(MessageDelivery), useValue: mockRepository },
        {
          provide: getRepositoryToken(DeliveryEvent),
          useValue: { createQueryBuilder: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    notificationRepository = module.get(getRepositoryToken(Message));
  });

  describe("getDeliveryRateAnalytics", () => {
    beforeEach(() => {
      const notifications = [
        notification(MessageStatus.DELIVERED, NotificationChannel.EMAIL),
        notification(MessageStatus.DELIVERED, NotificationChannel.EMAIL),
        notification(MessageStatus.DELIVERED, NotificationChannel.SMS),
        notification(MessageStatus.FAILED, NotificationChannel.SMS),
      ];

      notificationRepository.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(notifications),
      } as any);
    });

    it("should count notifications by status", async () => {
      const result = await service.getDeliveryRateAnalytics({ tenantId: "tenant-1" });

      expect(result.totalNotifications).toBe(4);
      expect(result.deliveredCount).toBe(3);
      expect(result.failedCount).toBe(1);
    });

    it("should derive delivery and failure rates", async () => {
      const result = await service.getDeliveryRateAnalytics({ tenantId: "tenant-1" });

      expect(result.deliveryRate).toBe(75);
      expect(result.failureRate).toBe(25);
    });

    it("should report zero rates when there are no notifications", async () => {
      notificationRepository.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getDeliveryRateAnalytics({ tenantId: "tenant-1" });

      expect(result.totalNotifications).toBe(0);
      expect(result.deliveryRate).toBe(0);
      expect(result.failureRate).toBe(0);
    });

    it("should scope the query to the tenant", async () => {
      await service.getDeliveryRateAnalytics({ tenantId: "tenant-1" });

      const queryBuilder = notificationRepository.createQueryBuilder.mock.results[0].value;
      expect(queryBuilder.where).toHaveBeenCalledWith("notification.tenantId = :tenantId", {
        tenantId: "tenant-1",
      });
    });
  });

  describe("getDeliveryTrends", () => {
    it("should return the time-series data for the last 30 days", async () => {
      notificationRepository.createQueryBuilder.mockReturnValue({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await service.getDeliveryTrends("tenant-1");

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("AnalyticsService.getEventRates", () => {
  let service: AnalyticsService;
  let eventRepository: any;

  beforeEach(async () => {
    eventRepository = { createQueryBuilder: vi.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Message), useValue: { createQueryBuilder: vi.fn() } },
        { provide: getRepositoryToken(MessageDelivery), useValue: { createQueryBuilder: vi.fn() } },
        { provide: getRepositoryToken(DeliveryEvent), useValue: eventRepository },
      ],
    }).compile();
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it("computes bounce/open/click rates per channel", async () => {
    eventRepository.createQueryBuilder.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      addGroupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { channel: "email", type: "sent", bounceType: null, count: "100" },
        { channel: "email", type: "delivered", bounceType: null, count: "90" },
        { channel: "email", type: "opened", bounceType: null, count: "45" },
        { channel: "email", type: "clicked", bounceType: null, count: "18" },
        { channel: "email", type: "bounced", bounceType: "hard", count: "3" },
        { channel: "email", type: "bounced", bounceType: "soft", count: "2" },
        { channel: "email", type: "complained", bounceType: null, count: "1" },
      ]),
    });

    const [row] = await service.getEventRates({ tenantId: "tenant-1" });

    expect(row).toMatchObject({
      channel: "email",
      sent: 100,
      delivered: 90,
      opened: 45,
      clicked: 18,
      bouncedHard: 3,
      bouncedSoft: 2,
      complained: 1,
      deliveryRate: 0.9,
      openRate: 0.5,
      clickRate: 0.2,
      bounceRate: 0.05,
      complaintRate: 0.01,
    });
  });
});
