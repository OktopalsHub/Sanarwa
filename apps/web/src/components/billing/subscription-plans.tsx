'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCheckoutCurrency } from '@/hooks/use-checkout-currency';
import { billingApi } from '@/lib/api';
import {
  type CurrencyCode,
  formatMoney,
  formatTokens,
  packagesForCurrency,
  packPrice,
  sendsFromTokens,
} from '@/lib/pricing';
import { toast } from 'sonner';

/** Pay-as-you-go token packs — not subscription plans. */
export function TokenPacks() {
  const { currency, setCurrency, availableCurrencies, isReady } = useCheckoutCurrency();
  const [pendingPackId, setPendingPackId] = useState<string | null>(null);

  const activeCurrency = (isReady ? currency : 'USD') as CurrencyCode;
  const packs = packagesForCurrency(activeCurrency);

  const handlePurchase = async (packageId: string) => {
    setPendingPackId(packageId);
    try {
      const result = await billingApi.purchaseTokens({
        packageId,
        currency: activeCurrency,
      });

      if (!result.checkoutUrl) {
        throw new Error('Checkout URL missing from server response');
      }

      window.location.href = result.checkoutUrl;
    } catch (error) {
      console.error('Token purchase failed:', error);
      toast.error('Could not start checkout. Please try again.');
      setPendingPackId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Buy tokens</h3>
          <p className="text-sm text-muted-foreground">
            Pay as you go — top up when you need. Showing {activeCurrency} only.
          </p>
        </div>
        {availableCurrencies.length > 1 ? (
          <button
            type="button"
            onClick={() =>
              setCurrency(activeCurrency === 'NGN' ? 'USD' : 'NGN')
            }
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Switch to {activeCurrency === 'NGN' ? 'USD' : 'NGN'}
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {packs.map((pkg) => {
          const isPending = pendingPackId === pkg.id;
          return (
            <Card
              key={pkg.id}
              className={pkg.savingsPercent >= 20 ? 'border-primary shadow-md h-full' : 'h-full'}
            >
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
                  {formatMoney(packPrice(pkg, activeCurrency), activeCurrency)}
                </p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={Boolean(pendingPackId)}
                  onClick={() => handlePurchase(pkg.id)}
                >
                  {isPending ? 'Redirecting…' : 'Buy pack'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated Use TokenPacks — system is pay-as-you-go, not subscriptions */
export const SubscriptionPlans = TokenPacks;
