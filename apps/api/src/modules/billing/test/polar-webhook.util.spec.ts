import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyPolarWebhook } from '../utils/polar-webhook.util';

const secret = 'polar-secret';
const purchaseId = 'purchase-123';

describe('verifyPolarWebhook', () => {
  it('accepts a valid checkout.updated success event', () => {
    const rawBody = JSON.stringify({
      type: 'checkout.updated',
      data: {
        id: 'checkout-1',
        status: 'succeeded',
        metadata: { purchaseId },
      },
    });
    const webhookId = 'msg_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signedContent = `${webhookId}.${timestamp}.${rawBody}`;
    const signature = createHmac('sha256', secret).update(signedContent).digest('base64');

    expect(
      verifyPolarWebhook(
        {
          rawBody,
          headers: {
            'webhook-id': webhookId,
            'webhook-timestamp': timestamp,
            'webhook-signature': `v1,${signature}`,
          },
        },
        secret,
      ),
    ).toMatchObject({
      eventId: webhookId,
      purchaseId,
      outcome: 'success',
    });
  });

  it('rejects invalid signatures', () => {
    const rawBody = JSON.stringify({
      type: 'checkout.updated',
      data: { id: 'checkout-1', status: 'succeeded', metadata: { purchaseId } },
    });

    expect(
      verifyPolarWebhook(
        {
          rawBody,
          headers: {
            'webhook-id': 'msg_1',
            'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
            'webhook-signature': 'v1,bad-signature',
          },
        },
        secret,
      ),
    ).toBeNull();
  });
});
