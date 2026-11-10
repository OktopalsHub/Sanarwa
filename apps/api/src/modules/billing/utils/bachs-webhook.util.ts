import { createHmac, timingSafeEqual } from "node:crypto";

import {
  parsePaymentMethodSetupReference,
  parsePurchaseReference,
} from "../constants/token-packages";

const TIMESTAMP_SKEW_SECONDS = 300;

const SUCCESS_STATUSES = new Set(["succeeded", "accepted", "overpaid"]);

export interface BachsWebhookVerifyInput {
  rawBody: string;

  headers: Record<string, string | string[] | undefined>;
}

export interface BachsWebhookVerifyResult {
  eventId?: string;

  eventType: string;

  outcome: "success" | "failed" | "ignored";

  purchaseId: string | null;

  setupReference: string | null;

  checkoutId?: string;

  chargeId?: string;

  merchantReference?: string;

  tenantId?: string;

  currency?: string;

  customerId?: string;

  paymentMethodId?: string;

  subscriptionId?: string;

  metadata?: Record<string, unknown>;
}

type BachsWebhookPayload = {
  id?: string;

  type?: string;

  data?: {
    charge_id?: string | null;

    checkout_id?: string | null;

    reference?: string | null;

    status?: string;

    metadata?: Record<string, unknown>;

    customer?: { customer_id?: string; id?: string };

    subscription?: { subscription_id?: string; id?: string };

    payment_method_id?: string;
  };
};

export function verifyBachsWebhook(
  input: BachsWebhookVerifyInput,

  webhookSecret: string,
): BachsWebhookVerifyResult | null {
  if (!verifyBachsSignature(input, webhookSecret)) {
    return null;
  }

  const body = JSON.parse(input.rawBody) as BachsWebhookPayload;

  const eventType = body.type ?? "";

  const merchantReference = body.data?.reference ?? undefined;

  const metadata = body.data?.metadata ?? {};

  const purchaseId = parsePurchaseReference(merchantReference);

  const setupReference =
    parsePaymentMethodSetupReference(merchantReference) ??
    (metadata.setup_reference ? String(metadata.setup_reference) : null);

  const tenantId = metadata.tenant_id !== undefined ? String(metadata.tenant_id) : undefined;

  const currency = metadata.currency !== undefined ? String(metadata.currency) : undefined;

  if (eventType === "collection.abandoned" || eventType === "collection.underpaid") {
    return null;
  }

  if (
    eventType === "customer.subscription.created" ||
    eventType === "customer.subscription.updated"
  ) {
    const purpose = metadata.purpose ? String(metadata.purpose) : undefined;

    if (purpose !== "payment_method_setup" && !setupReference) {
      return {
        eventId: body.id,

        eventType,

        outcome: "ignored",

        purchaseId: null,

        setupReference: null,
      };
    }

    const setupStatus = body.data?.status?.toLowerCase();
    if (setupStatus && !SUCCESS_STATUSES.has(setupStatus)) {
      return {
        eventId: body.id,
        eventType,
        outcome:
          setupStatus === "failed" || setupStatus === "canceled" || setupStatus === "cancelled"
            ? "failed"
            : "ignored",
        purchaseId: null,
        setupReference,
        tenantId,
        currency,
        metadata,
      };
    }

    return {
      eventId: body.id,

      eventType,

      outcome: "success",

      purchaseId: null,

      setupReference,

      checkoutId: body.data?.checkout_id ?? undefined,

      tenantId,

      currency,

      customerId: body.data?.customer?.customer_id ?? body.data?.customer?.id ?? undefined,

      paymentMethodId: body.data?.payment_method_id,

      subscriptionId:
        body.data?.subscription?.subscription_id ?? body.data?.subscription?.id ?? undefined,

      metadata,
    };
  }

  if (eventType !== "collection.succeeded" && eventType !== "collection.failed") {
    return {
      eventId: body.id,

      eventType,

      outcome: "ignored",

      purchaseId,

      setupReference,

      merchantReference,
    };
  }

  const checkoutId = body.data?.checkout_id ?? undefined;

  const chargeId = body.data?.charge_id ?? undefined;

  if (eventType === "collection.failed") {
    const providerReference = chargeId ?? checkoutId ?? merchantReference;

    if (!providerReference) return null;

    return {
      eventId: body.id,

      eventType,

      outcome: "failed",

      purchaseId,

      setupReference,

      checkoutId,

      chargeId: chargeId ?? undefined,

      merchantReference,

      tenantId,

      currency,

      metadata,
    };
  }

  const status = body.data?.status?.toLowerCase();

  if (!status || !SUCCESS_STATUSES.has(status)) {
    return null;
  }

  if (!chargeId && !checkoutId && !purchaseId && !setupReference) return null;

  return {
    eventId: body.id,

    eventType,

    outcome: "success",

    purchaseId,

    setupReference,

    checkoutId,

    chargeId: chargeId ?? undefined,

    merchantReference,

    tenantId,

    currency,

    customerId: body.data?.customer?.customer_id ?? body.data?.customer?.id ?? undefined,

    paymentMethodId: body.data?.payment_method_id,

    subscriptionId:
      body.data?.subscription?.subscription_id ?? body.data?.subscription?.id ?? undefined,

    metadata,
  };
}

/**
 * Bachs signs every delivery. `X-Bachs-Signature-V2` is preferred: it carries the
 * scheme name and repeats `v1=` once per currently valid secret, so a rotation
 * keeps verifying while the new secret is deployed. `X-Bachs-Signature` is the
 * single-secret form and stays supported.
 */
function verifyBachsSignature(
  input: BachsWebhookVerifyInput,

  webhookSecret: string,
): boolean {
  if (!webhookSecret) return false;

  const v2 = getHeader(input.headers, "x-bachs-signature-v2");

  if (v2) {
    const parts = v2.split(",").map((part) => part.trim());

    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);

    const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));

    if (!timestamp || signatures.length === 0) return false;

    return signatures.some((presented) =>
      matches(timestamp, presented, input.rawBody, webhookSecret),
    );
  }

  const signature = getHeader(input.headers, "x-bachs-signature");
  const timestamp = getHeader(input.headers, "x-bachs-timestamp");

  if (!signature || !timestamp) return false;

  return matches(timestamp, signature, input.rawBody, webhookSecret);
}

function matches(
  timestamp: string,
  presented: string,
  rawBody: string,
  webhookSecret: string,
): boolean {
  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBody}`)

    .digest("hex");

  return safeEqual(presented, expected);
}

function getHeader(
  headers: Record<string, string | string[] | undefined>,

  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];

  if (!value) return null;

  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);

  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}
