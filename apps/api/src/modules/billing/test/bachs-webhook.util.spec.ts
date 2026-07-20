import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyBachsWebhook } from '../utils/bachs-webhook.util';

const purchaseId = '11111111-1111-1111-1111-111111111111';
const secret = 'bachs-webhook-secret';

function sign(rawBody: string, timestamp: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

describe('verifyBachsWebhook', () => {
  it('accepts collection.succeeded with valid signature', () => {
    const rawBody = JSON.stringify({
      id: 'evt-1',
      type: 'collection.succeeded',
      data: {
        charge_id: 'ch_1',
        checkout_id: 'co_1',
        reference: `notifi_purchase_${purchaseId}`,
        status: 'succeeded',
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            'x-bachs-signature': sign(rawBody, timestamp),
            'x-bachs-timestamp': timestamp,
          },
        },
        secret,
      ),
    ).toMatchObject({
      eventId: 'evt-1',
      outcome: 'success',
      purchaseId,
      setupReference: null,
    });
  });

  it('rejects invalid signatures', () => {
    const rawBody = JSON.stringify({
      id: 'evt-1',
      type: 'collection.succeeded',
      data: {
        charge_id: 'ch_1',
        reference: `notifi_purchase_${purchaseId}`,
        status: 'succeeded',
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            'x-bachs-signature': 'bad-signature',
            'x-bachs-timestamp': timestamp,
          },
        },
        secret,
      ),
    ).toBeNull();
  });

  it('rejects stale timestamps', () => {
    const rawBody = JSON.stringify({
      id: 'evt-1',
      type: 'collection.succeeded',
      data: {
        charge_id: 'ch_1',
        reference: `notifi_purchase_${purchaseId}`,
        status: 'succeeded',
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            'x-bachs-signature': sign(rawBody, timestamp),
            'x-bachs-timestamp': timestamp,
          },
        },
        secret,
      ),
    ).toBeNull();
  });

  it('ignores abandoned collections', () => {
    const rawBody = JSON.stringify({
      id: 'evt-2',
      type: 'collection.abandoned',
      data: { reference: `notifi_purchase_${purchaseId}` },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(
      verifyBachsWebhook(
        {
          rawBody,
          headers: {
            'x-bachs-signature': sign(rawBody, timestamp),
            'x-bachs-timestamp': timestamp,
          },
        },
        secret,
      ),
    ).toBeNull();
  });
});
