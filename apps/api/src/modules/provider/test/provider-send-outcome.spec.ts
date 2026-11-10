import { describe, expect, it } from "vitest";
import { toProviderSendOutcome } from "../provider-send-outcome";

describe("toProviderSendOutcome", () => {
  it("reads the message id from an email result", () => {
    const outcome = toProviderSendOutcome({
      messageId: "email-1",
      status: "sent",
      providerId: "ses",
      timestamp: new Date(),
    });

    expect(outcome).toEqual({ status: "sent", externalId: "email-1" });
  });

  it("detects email failure, which the email result never signals via success", () => {
    const outcome = toProviderSendOutcome({
      messageId: "",
      status: "failed",
      providerId: "ses",
      timestamp: new Date(),
    });

    expect(outcome.status).toBe("failed");
    expect(outcome).toMatchObject({ reason: "provider reported failure" });
  });

  it("carries the provider error message through", () => {
    const outcome = toProviderSendOutcome({
      success: false,
      error: "provider rejected",
      provider: "twilio",
    });

    expect(outcome).toEqual({ status: "failed", reason: "provider rejected" });
  });

  it("reads success from an sms result", () => {
    const outcome = toProviderSendOutcome({
      success: true,
      messageId: "SM123",
      provider: "twilio",
    });

    expect(outcome).toEqual({ status: "sent", externalId: "SM123" });
  });

  it("reads the capitalised id some adapters use", () => {
    const outcome = toProviderSendOutcome({ success: true, MessageId: "wa-1", provider: "meta" });

    expect(outcome).toEqual({ status: "sent", externalId: "wa-1" });
  });

  it("reports failure rather than assuming success when the shape is unknown", () => {
    const outcome = toProviderSendOutcome({ somethingElse: true });

    expect(outcome).toEqual({ status: "failed", reason: "unrecognized provider result shape" });
  });

  it("reports failure when a provider returns nothing", () => {
    expect(toProviderSendOutcome(undefined)).toMatchObject({ status: "failed" });
    expect(toProviderSendOutcome(null)).toMatchObject({ status: "failed" });
  });
});
