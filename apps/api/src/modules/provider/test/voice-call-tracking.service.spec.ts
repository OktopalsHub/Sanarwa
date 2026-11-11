import { describe, expect, it, vi, beforeEach } from "vitest";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { VoiceCall } from "../entities/voice-call.entity";
import { VoiceCallTrackingService } from "../services/voice-call-tracking.service";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";

function callRecord(overrides: Partial<VoiceCall> = {}): VoiceCall {
  return {
    id: "vc-1",
    callControlId: "cc-1",
    tenantId: "tenant-1",
    phoneNumber: "+15551234567",
    status: "connected",
    startedAt: new Date(Date.now() - 125_000),
    ...overrides,
  } as VoiceCall;
}

describe("VoiceCallTrackingService voice billing", () => {
  let service: VoiceCallTrackingService;
  let voiceCallRepo: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let billing: { processNotificationTokenUsage: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    voiceCallRepo = {
      findOne: vi.fn().mockResolvedValue(callRecord()),
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

  it("bills ceiling minutes of managed voice usage at hangup", async () => {
    await service.endCall({ callControlId: "cc-1", durationSeconds: 125 });

    expect(billing.processNotificationTokenUsage).toHaveBeenCalledWith(
      "tenant-1",
      "voice",
      "voice:cc-1",
      "managed",
      { durationMinutes: 3, callControlId: "cc-1" },
      3,
    );
    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { callControlId: "cc-1" },
      expect.objectContaining({ status: "ended" }),
    );
  });

  it("does not bill a call that never connected", async () => {
    await service.endCall({ callControlId: "cc-1", durationSeconds: 0 });

    expect(billing.processNotificationTokenUsage).not.toHaveBeenCalled();
    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { callControlId: "cc-1" },
      expect.objectContaining({ status: "ended" }),
    );
  });

  it("does not bill twice when the hangup webhook is delivered twice", async () => {
    voiceCallRepo.findOne.mockResolvedValueOnce(callRecord({ status: "ended" }));

    await service.endCall({ callControlId: "cc-1", durationSeconds: 125 });

    expect(billing.processNotificationTokenUsage).not.toHaveBeenCalled();
    expect(voiceCallRepo.update).not.toHaveBeenCalled();
  });

  it("still marks the call ended when billing fails", async () => {
    billing.processNotificationTokenUsage.mockRejectedValueOnce(new Error("insufficient tokens"));

    await expect(
      service.endCall({ callControlId: "cc-1", durationSeconds: 125 }),
    ).resolves.toBeUndefined();

    expect(voiceCallRepo.update).toHaveBeenCalledWith(
      { callControlId: "cc-1" },
      expect.objectContaining({ status: "ended" }),
    );
  });
});
