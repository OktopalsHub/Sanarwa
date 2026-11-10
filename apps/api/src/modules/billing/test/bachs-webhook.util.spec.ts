import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyBachsWebhook } from "../utils/bachs-webhook.util";

const purchaseId = "11111111-1111-1111-1111-111111111111";
const secret = "bachs-webhook-secret";

function sign(rawBody: string, timestamp: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

describe("verifyBachsWebhook", () => {
  it("accepts collection.succeeded with valid signature", () => {
    const rawBody = JSON.stringify({
      id: "evt-1",
      type: "collection.succeeded",
      data: {
        charge_id: "ch_1",
        checkout_id: "co_1",
        reference: `sanarwa_purchase_${purchaseId}`,
        status: "succeeded",
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            "x-bachs-signature": sign(rawBody, timestamp),
            "x-bachs-timestamp": timestamp,
          },
        },
        secret,
      ),
    ).toMatchObject({
      eventId: "evt-1",
      outcome: "success",
      purchaseId,
      setupReference: null,
    });
  });

  it("rejects invalid signatures", () => {
    const rawBody = JSON.stringify({
      id: "evt-1",
      type: "collection.succeeded",
      data: {
        charge_id: "ch_1",
        reference: `sanarwa_purchase_${purchaseId}`,
        status: "succeeded",
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            "x-bachs-signature": "bad-signature",
            "x-bachs-timestamp": timestamp,
          },
        },
        secret,
      ),
    ).toBeNull();
  });

  it("rejects stale timestamps", () => {
    const rawBody = JSON.stringify({
      id: "evt-1",
      type: "collection.succeeded",
      data: {
        charge_id: "ch_1",
        reference: `sanarwa_purchase_${purchaseId}`,
        status: "succeeded",
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            "x-bachs-signature": sign(rawBody, timestamp),
            "x-bachs-timestamp": timestamp,
          },
        },
        secret,
      ),
    ).toBeNull();
  });

  it("ignores abandoned collections", () => {
    const rawBody = JSON.stringify({
      id: "evt-2",
      type: "collection.abandoned",
      data: { reference: `sanarwa_purchase_${purchaseId}` },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            "x-bachs-signature": sign(rawBody, timestamp),
            "x-bachs-timestamp": timestamp,
          },
        },
        secret,
      ),
    ).toBeNull();
  });
});

describe("verifyBachsWebhook against the documented payload", () => {
  const timestamp = String(Math.floor(Date.now() / 1000));

  function body(data: Record<string, unknown>) {
    return JSON.stringify({ id: "evt_x", type: "collection.succeeded", data });
  }

  function headers(rawBody: string) {
    return {
      "x-bachs-signature": sign(rawBody, timestamp),
      "x-bachs-timestamp": timestamp,
    };
  }

  it("accepts the uppercase SUCCEEDED status the API actually sends", () => {
    const rawBody = body({
      charge_id: "ch_1",
      checkout_id: "chk_1",
      reference: `sanarwa_purchase_${purchaseId}`,
      status: "SUCCEEDED",
    });

    expect(
      verifyBachsWebhook({ rawBody, headers: headers(rawBody) } as never, secret),
    ).toMatchObject({ outcome: "success", purchaseId });
  });

  it("accepts OVERPAID, where the customer paid more than due", () => {
    const rawBody = body({
      charge_id: "ch_2",
      checkout_id: "chk_2",
      reference: `sanarwa_purchase_${purchaseId}`,
      status: "OVERPAID",
      amount: "75000.00",
      currency: "NGN",
    });

    expect(
      verifyBachsWebhook({ rawBody, headers: headers(rawBody) } as never, secret),
    ).toMatchObject({ outcome: "success", purchaseId });
  });

  it("fulfils when charge_id is null but checkout_id is present", () => {
    const rawBody = body({
      charge_id: null,
      checkout_id: "chk_3",
      reference: `sanarwa_purchase_${purchaseId}`,
      status: "SUCCEEDED",
    });

    expect(
      verifyBachsWebhook({ rawBody, headers: headers(rawBody) } as never, secret),
    ).toMatchObject({ outcome: "success", purchaseId });
  });

  it("verifies the V2 signature header", () => {
    const rawBody = body({
      charge_id: "ch_4",
      checkout_id: "chk_4",
      reference: `sanarwa_purchase_${purchaseId}`,
      status: "SUCCEEDED",
    });

    const result = verifyBachsWebhook(
      {
        rawBody,
        headers: {
          "x-bachs-signature-v2": `t=${timestamp},v1=${sign(rawBody, timestamp)}`,
        },
      } as never,
      secret,
    );

    expect(result).toMatchObject({ outcome: "success", purchaseId });
  });

  it("accepts any v1 signature, so a secret rotation does not drop deliveries", () => {
    const rawBody = body({
      charge_id: "ch_5",
      checkout_id: "chk_5",
      reference: `sanarwa_purchase_${purchaseId}`,
      status: "SUCCEEDED",
    });

    const stale = createHmac("sha256", "old-secret")
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const result = verifyBachsWebhook(
      {
        rawBody,
        headers: {
          "x-bachs-signature-v2": `t=${timestamp},v1=${stale},v1=${sign(rawBody, timestamp)}`,
        },
      } as never,
      secret,
    );

    expect(result).toMatchObject({ outcome: "success", purchaseId });
  });

  it("rejects a V2 header where no v1 matches", () => {
    const rawBody = body({
      charge_id: "ch_6",
      checkout_id: "chk_6",
      reference: `sanarwa_purchase_${purchaseId}`,
      status: "SUCCEEDED",
    });

    const wrong = createHmac("sha256", "wrong").update(`${timestamp}.${rawBody}`).digest("hex");

    expect(
      verifyBachsWebhook(
        { rawBody, headers: { "x-bachs-signature-v2": `t=${timestamp},v1=${wrong}` } } as never,
        secret,
      ),
    ).toBeNull();
  });
});
