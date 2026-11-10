import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DeliveryEventService } from "../delivery-event.service";
import { DeliveryEvent } from "../../entities/delivery-event.entity";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery,
} from "../../message-delivery.entity";
import { ConsentService } from "../../../preferences/consent.service";
import { DeliveryEventType } from "../../enums/delivery-event-type.enum";
import { NotificationChannel } from "../../../../common/enums/notification-channel.enum";

function makeRepo() {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ id: "evt-1" }),
    create: vi.fn().mockImplementation((value) => value),
    update: vi.fn().mockResolvedValue({ affected: 1 }),
  };
}

const TENANT = "tenant-1";
const DELIVERY = {
  id: "delivery-1",
  tenantId: TENANT,
  messageId: "message-1",
  channel: "email" as NotificationChannel,
  providerId: "email",
  recipient: "User@Example.com ",
  status: DeliveryStatus.PENDING,
} as unknown as MessageDelivery;

describe("DeliveryEventService", () => {
  let service: DeliveryEventService;
  let eventsRepo: ReturnType<typeof makeRepo>;
  let deliveriesRepo: ReturnType<typeof makeRepo>;
  let consentService: { suppress: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    eventsRepo = makeRepo();
    deliveriesRepo = makeRepo();
    deliveriesRepo.findOne.mockResolvedValue(DELIVERY);
    consentService = { suppress: vi.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        DeliveryEventService,
        { provide: getRepositoryToken(DeliveryEvent), useValue: eventsRepo },
        { provide: getRepositoryToken(MessageDelivery), useValue: deliveriesRepo },
        { provide: ConsentService, useValue: consentService },
      ],
    }).compile();

    service = module.get(DeliveryEventService);
  });

  it("records an event for a matched delivery and marks it delivered", async () => {
    const result = await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-a",
      type: DeliveryEventType.DELIVERED,
    });

    expect(result).toEqual({ recorded: true, deliveryId: "delivery-1" });
    expect(eventsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        deliveryId: "delivery-1",
        type: DeliveryEventType.DELIVERED,
      }),
    );
    expect(deliveriesRepo.update).toHaveBeenCalledWith(
      { id: "delivery-1" },
      expect.objectContaining({ status: DeliveryStatus.DELIVERED }),
    );
    expect(consentService.suppress).not.toHaveBeenCalled();
  });

  it("records a hard bounce, suppresses the address, and does not erase the bounce", async () => {
    const result = await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-bounce",
      type: DeliveryEventType.BOUNCED,
      bounceType: "hard",
      reasonCode: "5.1.1",
    });

    expect(result).toEqual({ recorded: true, deliveryId: "delivery-1" });
    expect(consentService.suppress).toHaveBeenCalledWith(TENANT, "user@example.com", "bounce");
    expect(deliveriesRepo.update).toHaveBeenCalledWith(
      { id: "delivery-1" },
      expect.objectContaining({ status: DeliveryStatus.BOUNCED }),
    );
  });

  it("does not suppress on a soft bounce", async () => {
    await service.ingestProviderFeedback({
      provider: "mailgun",
      providerMessageId: "<msg@mg>",
      providerEventId: "evt-soft",
      type: DeliveryEventType.BOUNCED,
      bounceType: "soft",
    });

    expect(consentService.suppress).not.toHaveBeenCalled();
  });

  it("suppresses on complaint with reason complaint", async () => {
    await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-complaint",
      type: DeliveryEventType.COMPLAINED,
    });

    expect(consentService.suppress).toHaveBeenCalledWith(TENANT, "user@example.com", "complaint");
  });

  it("suppresses on unsubscribe with reason unsubscribe", async () => {
    await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-unsub",
      type: DeliveryEventType.UNSUBSCRIBED,
    });

    expect(consentService.suppress).toHaveBeenCalledWith(TENANT, "user@example.com", "unsubscribe");
  });

  it("records an opened event and backfills openedAt", async () => {
    await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-open",
      type: DeliveryEventType.OPENED,
      occurredAt: new Date("2026-11-09T10:00:00.000Z"),
    });

    expect(deliveriesRepo.update).toHaveBeenCalledWith(
      { id: "delivery-1" },
      expect.objectContaining({ status: DeliveryStatus.OPENED }),
    );
  });

  it("dedupes repeat provider event ids without recording or suppressing again", async () => {
    eventsRepo.save.mockRejectedValueOnce({ driverError: { code: "23505" } });

    const result = await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-dup",
      type: DeliveryEventType.BOUNCED,
      bounceType: "hard",
    });

    expect(result).toEqual({ recorded: false, reason: "duplicate" });
    expect(consentService.suppress).not.toHaveBeenCalled();
    expect(deliveriesRepo.update).not.toHaveBeenCalled();
  });

  it("returns orphan when the provider message id matches nothing", async () => {
    deliveriesRepo.findOne.mockResolvedValueOnce(null);

    const result = await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_unknown",
      providerEventId: "evt-orphan",
      type: DeliveryEventType.BOUNCED,
      bounceType: "hard",
    });

    expect(result).toEqual({ recorded: false, reason: "orphan" });
    expect(eventsRepo.save).not.toHaveBeenCalled();
    expect(consentService.suppress).not.toHaveBeenCalled();
  });

  it("records a dropped event with a diagnostic instead of silently failing", async () => {
    await service.ingestProviderFeedback({
      provider: "sendgrid",
      providerMessageId: "sg_msg_1",
      providerEventId: "evt-drop",
      type: DeliveryEventType.DROPPED,
      diagnostic: "Suppressed by provider",
    });

    expect(deliveriesRepo.update).toHaveBeenCalledWith(
      { id: "delivery-1" },
      expect.objectContaining({ status: DeliveryStatus.FAILED }),
    );
  });

  it("records outbound send outcomes through the same service", async () => {
    const result = await service.record({
      tenantId: TENANT,
      channel: NotificationChannel.PUSH,
      provider: "push",
      type: DeliveryEventType.SENT,
      messageId: "message-1",
      deliveryId: "delivery-1",
    });

    expect(result).toEqual({ id: "evt-1", created: true });
    expect(eventsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        provider: "push",
        type: DeliveryEventType.SENT,
      }),
    );
  });
});
