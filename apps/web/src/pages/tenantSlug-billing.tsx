'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from '@/compat/next-navigation';
import { BillingOverview } from '@/components/billing/billing-overview';
import { AutoTopupSettings } from '@/components/billing/auto-topup-settings';
import { TokenPacks } from '@/components/billing/subscription-plans';
import { BillingHistory } from '@/components/billing/billing-history';
import { AppShell } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { billingApi } from '@/lib/api';
import { CreditCardIcon, CubeIcon, ClockIcon } from '@heroicons/react/24/outline';

function CheckoutStatusBanner() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get('checkout');
  const purchaseId = searchParams.get('purchase_id') ?? searchParams.get('checkout_id');
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState<'default' | 'destructive'>('default');

  useEffect(() => {
    if (checkout === 'cancel') {
      setMessage('Checkout was cancelled. You can pick a pack and try again.');
      setVariant('default');
      return;
    }

    if (checkout !== 'success') {
      return;
    }

    let cancelled = false;
    setMessage('Payment received — confirming your token purchase…');

    const poll = async () => {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (cancelled) return;

        try {
          if (purchaseId) {
            const status = await billingApi.syncPurchase(purchaseId);
            if (status.status === 'completed') {
              setMessage('Payment confirmed. Your token balance has been updated.');
              return;
            }
            if (status.status === 'failed') {
              setMessage('Payment failed. Please contact support if you were charged.');
              setVariant('destructive');
              return;
            }
          }
        } catch {
          /* keep polling */
        }

        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      if (!cancelled) {
        setMessage(
          'Payment is still processing. Your balance will update shortly once confirmation completes.',
        );
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [checkout, purchaseId]);

  if (!message) {
    return null;
  }

  return (
    <div
      className={
        variant === 'destructive'
          ? 'rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm'
          : 'rounded-lg border bg-muted/40 px-4 py-3 text-sm'
      }
    >
      <p className="font-medium">
        {checkout === 'cancel' ? 'Checkout cancelled' : 'Checkout status'}
      </p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('checkout') ? 'packs' : 'overview';

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Billing & Usage</h1>
            <p className="text-muted-foreground">
              Pay as you go — buy tokens, track usage, and view history
            </p>
          </div>

          <CheckoutStatusBanner />

          <Tabs defaultValue={defaultTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">
                <CreditCardIcon className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="packs">
                <CubeIcon className="h-4 w-4 mr-2" />
                Token packs
              </TabsTrigger>
              <TabsTrigger value="history">
                <ClockIcon className="h-4 w-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <BillingOverview />
              <AutoTopupSettings />
            </TabsContent>

            <TabsContent value="packs">
              <TokenPacks />
            </TabsContent>

            <TabsContent value="history">
              <BillingHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
