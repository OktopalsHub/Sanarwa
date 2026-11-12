import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { VoiceCall } from "../entities/voice-call.entity";
import { VoiceCallTrackingService } from "../services/voice-call-tracking.service";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";

const MINUTE_MS = 60_000;

function callRecord(overrides: Partial<VoiceCall> = {}): VoiceCall {
  return {
    id: "vc-1",
    callControlId: "cc-1",
    tenantId: "tenant-1",
    phoneNumber: "+15551234567",
    status: "connected",
    startedAt: new Date(Date.now() - 300_000),
    answeredAt: new Date(Date.now() - 125_000),
    ...overrides,
  } as VoiceCall;
}

describe("VoiceCallTrackingService voice billing", () => {
  let service: VoiceCallTrackingService;
  let voiceCallRepo: {
    findOne: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let billing: { processNotificationTokenUsage: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    voiceCallRepo = {
      findOne: vi.fn().mockResolvedValue(callRecord()),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((value) => value),
      save: vi.fn().mockResolvedValue({ id: "vc-1" }),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    billing = { processNotificationTokenUsage: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceCallTrackingService,
        { provide: getRepositoryToken(VoiceCall), useValue: voiceCallRepo },
        { provide: BillingIntegrationService, useValue: billing },
      ],
    }).compile();

    service = module.get(VoiceCallTrackingService);
  });

  it("bills ceiling minutes counted from the moment the call was answered", async () => {
    await service.endCall({ callControlId: "cc-1" });

    expect(billing.processNotificationTokenUsage).toHaveBeenCalledWith(
      "tenant-1",
      "voice",
      "voice:cc-1",
      "managed",
      { durationMinutes: 3, callControlId: "cc-1" },
      3,
      { dedupeByReference: true },
    );
    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { callControlId: "cc-1" },
      expect.objectContaining({ status: "ended" }),
    );
  });

  it("does not bill ring time when the call was never answered", async () => {
    voiceCallRepo.findOne.mockResolvedValueOnce(
      callRecord({ status: "initiated", answeredAt: undefined }),
    );

    await service.endCall({ callControlId: "cc-1", hangupCause: "no_answer" });

    expect(billing.processNotificationTokenUsage).not.toHaveBeenCalled();
    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { callControlId: "cc-1" },
      expect.objectContaining({ status: "ended", duration: 0 }),
    );
  });

  it("does not bill twice when the hangup webhook is delivered twice", async () => {
    voiceCallRepo.findOne.mockResolvedValueOnce(callRecord({ status: "ended" }));

    await service.endCall({ callControlId: "cc-1" });

    expect(billing.processNotificationTokenUsage).not.toHaveBeenCalled();
    expect(voiceCallRepo.update).not.toHaveBeenCalled();
  });

  it("marks a call billed only after the charge succeeds", async () => {
    await service.endCall({ callControlId: "cc-1" });

    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { id: "vc-1" },
      expect.objectContaining({ billedAt: expect.any(Date) }),
    );
  });

  it("leaves a call unbilled when the charge fails so it can be retried", async () => {
    billing.processNotificationTokenUsage.mockRejectedValueOnce(new Error("insufficient tokens"));

    await expect(service.endCall({ callControlId: "cc-1" })).resolves.toBeUndefined();

    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { callControlId: "cc-1" },
      expect.objectContaining({ status: "ended" }),
    );
    expect(voiceCallRepo.update).not.toHaveBeenCalledWith(
      { id: "vc-1" },
      expect.objectContaining({ billedAt: expect.any(Date) }),
    );
  });

  describe("reconcile", () => {
    it("retries billing for an ended call whose charge failed", async () => {
      voiceCallRepo.find.mockResolvedValueOnce([
        callRecord({ status: "ended", duration: 70, billedAt: undefined }),
      ]);

      await service.reconcile();

      expect(billing.processNotificationTokenUsage).toHaveBeenCalledWith(
        "tenant-1",
        "voice",
        "voice:cc-1",
        "managed",
        { durationMinutes: 2, callControlId: "cc-1" },
        2,
        { dedupeByReference: true },
      );
    });

    it("closes a connected call that never got a hangup and bills the one-minute minimum", async () => {
      voiceCallRepo.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          callRecord({ answeredAt: new Date(Date.now() - 3 * 60 * MINUTE_MS) }),
        ]);

      await service.reconcile();

      expect(voiceCallRepo.update).toHaveBeenCalledWith(
        { id: "vc-1", status: "connected" },
        expect.objectContaining({
          status: "ended",
          hangupCause: "no_hangup_received",
          duration: 60,
        }),
      );
      expect(billing.processNotificationTokenUsage).toHaveBeenCalledWith(
        "tenant-1",
        "voice",
        "voice:cc-1",
        "managed",
        { durationMinutes: 1, callControlId: "cc-1" },
        1,
        { dedupeByReference: true },
      );
    });

    it("does not bill a stale call another instance already closed", async () => {
      voiceCallRepo.find.mockResolvedValueOnce([]).mockResolvedValueOnce([callRecord()]);
      voiceCallRepo.update
        .mockResolvedValueOnce({ affected: 0 })
        .mockResolvedValueOnce({ affected: 0 });

      await service.reconcile();

      expect(billing.processNotificationTokenUsage).not.toHaveBeenCalled();
    });
  });
});
