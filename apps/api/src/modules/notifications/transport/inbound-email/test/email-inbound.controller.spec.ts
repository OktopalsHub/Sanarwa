import { createHmac } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConsentService } from "../../../../preferences/consent.service";
import { NotificationCenterService } from "../../../services/notification-center.service";
import { EmailInboundController } from "../email-inbound.controller";
import { EmailInboundDto } from "../dto/email-inbound.dto";

const SECRET = "server-secret";
const TENANT = "tenant-1";

function sign(tenantId: string, messageId: string, threadId: string, epochMs: string): string {
  return createHmac("sha256", SECRET)
    .update(`${tenantId}:${messageId}:${threadId}:${epochMs}`)
    .digest("hex");
}

function makeDto(epochMs: string): EmailInboundDto {
  return {
    tenantId: TENANT,
    messageId: "msg-1",
    threadId: "thread-1",
    epochMs,
    hmacHex: sign(TENANT, "msg-1", "thread-1", epochMs),
    senderAddress: "sender@example.com",
    subject: "Re: hello",
    textBody: "hello back",
  } as EmailInboundDto;
}

describe("EmailInboundController", () => {
  let controller: EmailInboundController;
  let center: { upsertInboundItem: ReturnType<typeof vi.fn> };
  let consent: {
    checkConsent: ReturnType<typeof vi.fn>;
    suppress: ReturnType<typeof vi.fn>;
  };
  let config: { get: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    center = { upsertInboundItem: vi.fn() };
    consent = {
      checkConsent: vi.fn().mockResolvedValue({ allowed: true }),
      suppress: vi.fn(),
    };
    config = { get: vi.fn().mockReturnValue(SECRET) };

    const module = await Test.createTestingModule({
      controllers: [EmailInboundController],
      providers: [
        { provide: NotificationCenterService, useValue: center },
        { provide: ConsentService, useValue: consent },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    controller = module.get(EmailInboundController);
  });

  it("stores a correctly signed inbound email with 30d default retention", async () => {
    center.upsertInboundItem.mockResolvedValue({
      messageId: "msg-1",
      metadata: { threadId: "thread-1" },
    });

    const result = await controller.receiveEmail(makeDto(String(Date.now())));

    expect(result).toMatchObject({ status: "received", threadId: "thread-1" });
    expect(center.upsertInboundItem).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT,
        messageId: "msg-1",
        channel: "email",
        expiresAt: expect.any(Date),
      }),
    );
  });

  it("rejects forgery when the body supplies its own secret", async () => {
    const epochMs = String(Date.now());
    const forged = createHmac("sha256", "attacker-secret")
      .update(`${TENANT}:msg-1:thread-1:${epochMs}`)
      .digest("hex");
    const dto = {
      ...makeDto(epochMs),
      hmacHex: forged,
      tokenSecret: "attacker-secret",
    } as EmailInboundDto;

    await expect(controller.receiveEmail(dto)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(center.upsertInboundItem).not.toHaveBeenCalled();
  });

  it("fails closed when INBOUND_EMAIL_SECRET is not configured", async () => {
    config.get.mockReturnValue(undefined);

    await expect(controller.receiveEmail(makeDto(String(Date.now())))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(center.upsertInboundItem).not.toHaveBeenCalled();
  });

  it("rejects expired and future tokens and short hmacs without crashing", async () => {
    await expect(
      controller.receiveEmail(makeDto(String(Date.now() - 25 * 60 * 60 * 1000))),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      controller.receiveEmail(makeDto(String(Date.now() + 60 * 60 * 1000))),
    ).rejects.toBeInstanceOf(BadRequestException);

    const short = makeDto(String(Date.now()));
    short.hmacHex = "abc";
    await expect(controller.receiveEmail(short)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(center.upsertInboundItem).not.toHaveBeenCalled();
  });

  it("drops suppressed senders via ConsentService and re-persists suppression", async () => {
    consent.checkConsent.mockResolvedValue({ allowed: false, reason: "suppressed" });

    const result = await controller.receiveEmail(makeDto(String(Date.now())));

    expect(result).toMatchObject({ status: "suppressed" });
    expect(consent.suppress).toHaveBeenCalledWith(
      TENANT,
      "sender@example.com",
      "suppressed",
      "email",
    );
    expect(center.upsertInboundItem).not.toHaveBeenCalled();
  });

  it("ignores preference and quiet-hours verdicts for inbound mail", async () => {
    consent.checkConsent.mockResolvedValue({ allowed: false, reason: "preference" });
    center.upsertInboundItem.mockResolvedValue({
      messageId: "msg-1",
      metadata: { threadId: "thread-1" },
    });

    const result = await controller.receiveEmail(makeDto(String(Date.now())));

    expect(result).toMatchObject({ status: "received" });
  });
});
