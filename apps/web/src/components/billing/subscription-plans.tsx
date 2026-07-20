'use client';

import { useEffect, useState } from 'react';
import Link from '@/compat/next-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type CurrencyCode,
  formatMoney,
  formatTokens,
  packagesForCurrency,
  packPrice,
  sendsFromTokens,
} from '@/lib/pricing';

function detectPreferredCurrency(): CurrencyCode {
  if (typeof window === 'undefined') return 'USD';
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const hints = `${locale} ${tz}`.toLowerCase();
    if (hints.includes('-ng') || hints.includes('_ng') || hints.includes('nigeria') || tz === 'Africa/Lagos') {
      return 'NGN';
    }
  } catch {
    /* ignore */
  }
  return 'USD';
}

/** Pay-as-you-go token packs — not subscription plans. */
export function TokenPacks() {
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  useEffect(() => {
    setCurrency(detectPreferredCurrency());
  }, []);

  const packs = packagesForCurrency(currency);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Buy tokens</h3>
          <p className="text-sm text-muted-foreground">
            Pay as you go — top up when you need. Showing {currency} only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCurrency(currency === 'NGN' ? 'USD' : 'NGN')}
          className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Switch to {currency === 'NGN' ? 'USD' : 'NGN'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {packs.map((pkg) => {
          const href = `/register?pack=${encodeURIComponent(pkg.id)}&currency=${currency}`;
          return (
            <Link key={pkg.id} href={href} className="block transition-opacity hover:opacity-95">
              <Card className={pkg.savingsPercent >= 20 ? 'border-primary shadow-md h-full' : 'h-full'}>
                {pkg.savingsPercent > 0 ? (
                  <div className="px-6 pt-4">
                    <Badge variant="secondary">Save {pkg.savingsPercent}%</Badge>
                  </div>
                ) : null}
                <CardHeader className={pkg.savingsPercent > 0 ? 'pt-2' : undefined}>
                  <CardTitle className="font-mono text-xl">{formatTokens(pkg.tokens)} tokens</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    ≈ {formatTokens(sendsFromTokens('email', pkg.tokens))} emails
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="font-mono text-2xl font-bold">
                    {formatMoney(packPrice(pkg, currency), currency)}
                  </p>
                  <span className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground">
                    Buy pack
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use TokenPacks — system is pay-as-you-go, not subscriptions */
export const SubscriptionPlans = TokenPacks;
