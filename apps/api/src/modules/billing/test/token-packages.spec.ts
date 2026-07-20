import { describe, expect, it } from 'vitest';
import {
  buildNotifiPurchaseReference,
  parseNotifiPurchaseReference,
  resolvePackage,
} from '../constants/token-packages';

describe('token-packages catalog', () => {
  it('resolves USD managed packages server-side', () => {
    const pkg = resolvePackage('usd-3000', 'USD');
    expect(pkg.tokens).toBe(3000);
    expect(pkg.price).toBe(1);
    expect(pkg.currency).toBe('USD');
  });

  it('rejects mismatched currency', () => {
    expect(() => resolvePackage('usd-3000', 'NGN')).toThrow();
  });

  it('round-trips purchase references', () => {
    const purchaseId = 'abc-123';
    const reference = buildNotifiPurchaseReference(purchaseId);
    expect(parseNotifiPurchaseReference(reference)).toBe(purchaseId);
  });
});
