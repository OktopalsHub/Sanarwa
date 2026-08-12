import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseNotifiPaymentMethodSetupReference } from '../constants/token-packages';

const TIMESTAMP_SKEW_SECONDS = 300;

export interface PolarWebhookVerifyInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface PolarWebhookVerifyResult {
  eventId: string;
  eventType: string;
  purchaseId?: string;
  setupReference?: string;
  tenantId?: string;
  currency?: string;
  customerId?: string;
  paymentMethodId?: string;
  providerReference?: string;
  amount?: number;
  outcome: 'success' | 'failed' | 'ignored';
}

type PolarWebhookPayload = {
  type?: string;
  data?: {
    id?: string;
    status?: string;
    amount?: number;
    total_amount?: number;
    metadata?: Record<string, unknown>;
  };
};

export function verifyPolarWebhook(
  input: PolarWebhookVerifyInput,
  webhookSecret: string,
): PolarWebhookVerifyResult | null {
  const webhookId = getHeader(input.headers, 'webhook-id');
  const timestamp = getHeader(input.headers, 'webhook-timestamp');
  const signature = getHeader(input.headers, 'webhook-signature');

  if (!webhookId || !timestamp || !signature || !webhookSecret) return null;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_SKEW_SECONDS) {
    return null;
  }

  const signedContent = `${webhookId}.${timestamp}.${input.rawBody}`;
  const expected = createHmac('sha256', webhookSecret).update(signedContent).digest('base64');

  const signatures = signature.split(' ');
  const isValid = signatures.some((part) => {
    const [, value] = part.split(',');
    if (!value) return false;
    return safeEqual(value, expected);
  });

  if (!isValid) return null;

  const body = JSON.parse(input.rawBody) as PolarWebhookPayload;
  const eventType = body.type ?? '';
  const metadata = body.data?.metadata ?? {};
  const purchaseIdRaw = metadata.purchaseId ?? metadata.purchase_id;
  const purchaseId =
    purchaseIdRaw !== undefined && purchaseIdRaw !== null
      ? String(purchaseIdRaw)
      : undefined;
  const setupReferenceRaw = metadata.setup_reference ?? metadata.setupReference;
  const setupReference =
    setupReferenceRaw !== undefined && setupReferenceRaw !== null
      ? String(setupReferenceRaw)
      : parseNotifiPaymentMethodSetupReference(
          typeof metadata.reference === 'string' ? metadata.reference : undefined,
        ) ?? undefined;
  const tenantIdRaw = metadata.tenant_id ?? metadata.tenantId;
  const tenantId =
    tenantIdRaw !== undefined && tenantIdRaw !== null ? String(tenantIdRaw) : undefined;
  const currencyRaw = metadata.currency;
  const currency =
    currencyRaw !== undefined && currencyRaw !== null ? String(currencyRaw) : undefined;
  const purpose = metadata.purpose ? String(metadata.purpose) : undefined;

  const providerReference = body.data?.id;
  const status = body.data?.status?.toLowerCase();
  const customerIdRaw = (body.data as { customer_id?: string })?.customer_id;
  const paymentMethodIdRaw = (body.data as { payment_method_id?: string })?.payment_method_id;
  const amountRaw = body.data?.amount ?? body.data?.total_amount;
  const amount =
    typeof amountRaw === 'number'
      ? amountRaw / 100
      : typeof amountRaw === 'string' && Number.isFinite(Number(amountRaw))
        ? Number(amountRaw) / 100
        : undefined;

  if (purpose === 'payment_method_setup' || setupReference) {
    if (status === 'failed' || status === 'expired' || status === 'canceled') {
      return {
        eventId: webhookId,
        eventType,
        setupReference,
        tenantId,
        currency,
        customerId: customerIdRaw,
        paymentMethodId: paymentMethodIdRaw,
        providerReference,
        amount,
        outcome: 'failed',
      };
    }

    if (status === 'succeeded' || status === 'paid') {
      return {
        eventId: webhookId,
        eventType,
        setupReference,
        tenantId,
        currency,
        customerId: customerIdRaw,
        paymentMethodId: paymentMethodIdRaw,
        providerReference,
        amount,
        outcome: 'success',
      };
    }
  }

  if (
    eventType === 'checkout.updated' ||
    eventType === 'order.paid' ||
    eventType === 'payment_intent.succeeded'
  ) {
    if (status === 'failed' || status === 'expired' || status === 'canceled') {
      return {
        eventId: webhookId,
        eventType,
        purchaseId,
        providerReference,
        amount,
        outcome: 'failed',
      };
    }

    if (status === 'succeeded' || status === 'paid' || eventType === 'payment_intent.succeeded') {
      return {
        eventId: webhookId,
        eventType,
        purchaseId,
        providerReference,
        amount,
        outcome: 'success',
      };
    }
  }

  return {
    eventId: webhookId,
    eventType,
    purchaseId,
    providerReference,
    amount,
    outcome: 'ignored',
  };
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
