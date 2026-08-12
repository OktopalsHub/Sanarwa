import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  parseNotifiPaymentMethodSetupReference,
  parseNotifiPurchaseReference,
} from '../constants/token-packages';

export interface NombaWebhookVerifyInput {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface NombaWebhookVerifyResult {
  eventId: string;
  eventType: string;
  outcome: 'success' | 'failed' | 'ignored';
  purchaseId?: string;
  setupReference?: string;
  tenantId?: string;
  currency?: string;
  customerId?: string;
  customerEmail?: string;
  tokenKey?: string;
  orderReference?: string;
  transactionId?: string;
  cardBrand?: string;
  cardLast4?: string;
}

type NombaWebhookPayload = {
  event_type?: string;
  requestId?: string;
  data?: {
    transaction?: {
      transactionId?: string;
      status?: string;
    };
    order?: {
      orderReference?: string;
      currency?: string;
      customerEmail?: string;
      customerId?: string;
      cardType?: string;
      cardLast4Digits?: string;
      orderMetaData?: Record<string, string>;
    };
    tokenizedCardData?: {
      tokenKey?: string;
      cardType?: string;
      cardPan?: string;
    };
    customer?: {
      billerId?: string;
      productId?: string;
    };
  };
};

export function verifyNombaWebhook(
  input: NombaWebhookVerifyInput,
  webhookSecret: string,
): NombaWebhookVerifyResult | null {
  const signature = getHeader(input.headers, 'nomba-signature');
  if (!signature || !webhookSecret) {
    return null;
  }

  const expected = createHmac('sha256', webhookSecret)
    .update(input.rawBody)
    .digest('base64');

  if (!safeEqual(signature, expected)) {
    return null;
  }

  const body = JSON.parse(input.rawBody) as NombaWebhookPayload;
  const eventType = body.event_type ?? '';
  const eventId = body.requestId ?? createHashFallback(input.rawBody);
  const orderReference = body.data?.order?.orderReference;
  const metadata = body.data?.order?.orderMetaData ?? {};
  const purchaseId =
    parseNotifiPurchaseReference(orderReference) ??
    (metadata.purchase_id ? String(metadata.purchase_id) : undefined);
  const setupReference =
    parseNotifiPaymentMethodSetupReference(orderReference) ??
    (metadata.setup_reference ? String(metadata.setup_reference) : undefined);
  const tenantId = metadata.tenant_id ? String(metadata.tenant_id) : undefined;
  const currency = body.data?.order?.currency ?? metadata.currency;
  const tokenKey = body.data?.tokenizedCardData?.tokenKey;

  if (eventType !== 'payment_success') {
    return {
      eventId,
      eventType,
      outcome: 'ignored',
      purchaseId,
      setupReference,
      orderReference,
    };
  }

  const txStatus = body.data?.transaction?.status?.toUpperCase();
  if (txStatus && txStatus !== 'SUCCESS') {
    return {
      eventId,
      eventType,
      outcome: 'failed',
      purchaseId,
      setupReference,
      orderReference,
      transactionId: body.data?.transaction?.transactionId,
    };
  }

  return {
    eventId,
    eventType,
    outcome: 'success',
    purchaseId,
    setupReference,
    tenantId,
    currency,
    customerId: body.data?.order?.customerId,
    customerEmail: body.data?.order?.customerEmail,
    tokenKey: tokenKey && tokenKey !== 'N/A' ? tokenKey : undefined,
    orderReference,
    transactionId: body.data?.transaction?.transactionId,
    cardBrand: body.data?.order?.cardType ?? body.data?.tokenizedCardData?.cardType,
    cardLast4: extractLast4(
      body.data?.order?.cardLast4Digits ?? body.data?.tokenizedCardData?.cardPan,
    ),
  };
}

function createHashFallback(rawBody: string): string {
  return createHmac('sha256', 'nomba').update(rawBody).digest('hex');
}

function extractLast4(value?: string): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  return digits.slice(-4) || undefined;
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
