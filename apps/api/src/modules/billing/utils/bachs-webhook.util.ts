import { createHmac, timingSafeEqual } from 'node:crypto';

import {

  parseNotifiPaymentMethodSetupReference,

  parseNotifiPurchaseReference,

} from '../constants/token-packages';



const TIMESTAMP_SKEW_SECONDS = 300;

const SUCCESS_STATUSES = new Set(['succeeded', 'accepted']);



export interface BachsWebhookVerifyInput {

  rawBody: string;

  headers: Record<string, string | string[] | undefined>;

}



export interface BachsWebhookVerifyResult {

  eventId?: string;

  eventType: string;

  outcome: 'success' | 'failed' | 'ignored';

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

  const eventType = body.type ?? '';

  const merchantReference = body.data?.reference ?? undefined;

  const metadata = body.data?.metadata ?? {};

  const purchaseId = parseNotifiPurchaseReference(merchantReference);

  const setupReference =

    parseNotifiPaymentMethodSetupReference(merchantReference) ??

    (metadata.setup_reference ? String(metadata.setup_reference) : null);

  const tenantId =

    metadata.tenant_id !== undefined ? String(metadata.tenant_id) : undefined;

  const currency =

    metadata.currency !== undefined ? String(metadata.currency) : undefined;



  if (eventType === 'collection.abandoned' || eventType === 'collection.underpaid') {

    return null;

  }



  if (

    eventType === 'customer.subscription.created' ||

    eventType === 'customer.subscription.updated'

  ) {

    const purpose = metadata.purpose ? String(metadata.purpose) : undefined;

    if (purpose !== 'payment_method_setup' && !setupReference) {

      return {

        eventId: body.id,

        eventType,

        outcome: 'ignored',

        purchaseId: null,

        setupReference: null,

      };

    }



    return {

      eventId: body.id,

      eventType,

      outcome: 'success',

      purchaseId: null,

      setupReference,

      checkoutId: body.data?.checkout_id ?? undefined,

      tenantId,

      currency,

      customerId:

        body.data?.customer?.customer_id ?? body.data?.customer?.id ?? undefined,

      paymentMethodId: body.data?.payment_method_id,

      subscriptionId:

        body.data?.subscription?.subscription_id ??

        body.data?.subscription?.id ??

        undefined,

      metadata,

    };

  }



  if (eventType !== 'collection.succeeded' && eventType !== 'collection.failed') {

    return {

      eventId: body.id,

      eventType,

      outcome: 'ignored',

      purchaseId,

      setupReference,

      merchantReference,

    };

  }



  const checkoutId = body.data?.checkout_id ?? undefined;

  const chargeId = body.data?.charge_id ?? undefined;



  if (eventType === 'collection.failed') {

    const providerReference = chargeId ?? checkoutId ?? merchantReference;

    if (!providerReference) return null;



    return {

      eventId: body.id,

      eventType,

      outcome: 'failed',

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



  if (!chargeId && !setupReference) return null;



  return {

    eventId: body.id,

    eventType,

    outcome: 'success',

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



function verifyBachsSignature(

  input: BachsWebhookVerifyInput,

  webhookSecret: string,

): boolean {

  const signature = getHeader(input.headers, 'x-bachs-signature');

  const timestamp = getHeader(input.headers, 'x-bachs-timestamp');



  if (!signature || !timestamp || !webhookSecret) return false;



  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) return false;



  const nowSeconds = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_SKEW_SECONDS) {

    return false;

  }



  const expected = createHmac('sha256', webhookSecret)

    .update(`${timestamp}.${input.rawBody}`)

    .digest('hex');



  return safeEqual(signature, expected);

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

