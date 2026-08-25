import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyNombaWebhook } from "../utils/nomba-webhook.util";

const purchaseId = "11111111-1111-1111-1111-111111111111";
const setupReference = "22222222-2222-2222-2222-222222222222";
const secret = "nomba-webhook-secret";

function sign(rawBody: string) {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

describe("verifyNombaWebhook", () => {
  it("accepts payment_success with valid signature for token purchase", () => {
    const rawBody = JSON.stringify({
      event_type: "payment_success",
      requestId: "req-1",
      data: {
        transaction: { transactionId: "txn-1", status: "SUCCESS" },
        order: {
          orderReference: `notifi_purchase_${purchaseId}`,
          currency: "NGN",
          customerEmail: "user@example.com",
          orderMetaData: {
            purchase_id: purchaseId,
            tenant_id: "tenant-1",
          },
        },
      },
    });

    expect(
      verifyNombaWebhook(
        {
          rawBody,
          headers: { "nomba-signature": sign(rawBody) },
        },
        secret,
      ),
    ).toMatchObject({
      eventId: "req-1",
      outcome: "success",
      purchaseId,
      tenantId: "tenant-1",
      currency: "NGN",
    });
  });

  it("extracts tokenKey for payment method setup", () => {
    const rawBody = JSON.stringify({
      event_type: "payment_success",
      requestId: "req-2",
      data: {
        order: {
          orderReference: `notifi_pm_setup_${setupReference}`,
          currency: "NGN",
          customerEmail: "user@example.com",
          cardType: "VISA",
          cardLast4Digits: "4242",
          orderMetaData: {
            purpose: "payment_method_setup",
            setup_reference: setupReference,
            tenant_id: "tenant-1",
            currency: "NGN",
          },
        },
        tokenizedCardData: {
          tokenKey: "tok_nomba_abc",
          cardType: "VISA",
          cardPan: "************4242",
        },
      },
    });

    expect(
      verifyNombaWebhook(
        {
          rawBody,
          headers: { "nomba-signature": sign(rawBody) },
        },
        secret,
      ),
    ).toMatchObject({
      outcome: "success",
      setupReference,
      tenantId: "tenant-1",
      tokenKey: "tok_nomba_abc",
      cardBrand: "VISA",
      cardLast4: "4242",
    });
  });

  it("rejects invalid signatures", () => {
    const rawBody = JSON.stringify({
      event_type: "payment_success",
      requestId: "req-3",
      data: {
        order: { orderReference: `notifi_purchase_${purchaseId}` },
      },
    });

    expect(
      verifyNombaWebhook(
        {
          rawBody,
          headers: { "nomba-signature": "invalid" },
        },
        secret,
      ),
    ).toBeNull();
  });

  it("ignores non-success event types", () => {
    const rawBody = JSON.stringify({
      event_type: "payment_failed",
      requestId: "req-4",
      data: {
        order: { orderReference: `notifi_purchase_${purchaseId}` },
      },
    });

    expect(
      verifyNombaWebhook(
        {
          rawBody,
          headers: { "nomba-signature": sign(rawBody) },
        },
        secret,
      ),
    ).toMatchObject({
      eventId: "req-4",
      outcome: "ignored",
      purchaseId,
    });
  });

  it("fails payment_success when transaction.status is not SUCCESS", () => {
    const rawBody = JSON.stringify({
      event_type: "payment_success",
      requestId: "req-5",
      data: {
        transaction: { transactionId: "txn-5", status: "PENDING" },
        order: {
          orderReference: `notifi_purchase_${purchaseId}`,
          currency: "NGN",
          orderMetaData: { purchase_id: purchaseId, tenant_id: "tenant-1" },
        },
      },
    });

    expect(
      verifyNombaWebhook(
        {
          rawBody,
          headers: { "nomba-signature": sign(rawBody) },
        },
        secret,
      ),
    ).toMatchObject({
      eventId: "req-5",
      outcome: "failed",
      purchaseId,
    });
  });
});
