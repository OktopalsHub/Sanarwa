'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { apiClient } from '@/lib/api/client';
import { useTenant } from '@/contexts/tenant-context';
import { useCheckoutCurrency } from '@/hooks/use-checkout-currency';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

export function AutoTopupSettings() {
  const { selectedTenant } = useTenant();
  const queryClient = useQueryClient();
  const { currency } = useCheckoutCurrency();
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'NGN'>(currency);
  const [enabled, setEnabled] = useState(false);
  const [thresholdAmount, setThresholdAmount] = useState('1000');
  const [packageId, setPackageId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  useEffect(() => {
    setSelectedCurrency(currency);
  }, [currency]);

  const { data: tokenCatalog } = useQuery({
    queryKey: ['token-packages'],
    queryFn: () => billingApi.getTokenPackages(),
  });

  const managedPackages = useMemo(() => {
    const shelf = tokenCatalog?.shelves.managed[selectedCurrency] ?? [];
    return shelf.filter((pkg) => pkg.kind !== 'byo');
  }, [tokenCatalog, selectedCurrency]);

  useEffect(() => {
    if (!packageId && managedPackages.length > 0) {
      setPackageId(managedPackages[0].id);
    }
  }, [managedPackages, packageId]);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['auto-topup-config', selectedTenant?.id],
    queryFn: async () => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      return billingApi.getAutoTopupConfig();
    },
    enabled: !!selectedTenant?.id,
  });

  const { data: paymentMethods, isLoading: methodsLoading } = useQuery({
    queryKey: ['payment-methods', selectedTenant?.id],
    queryFn: async () => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      return billingApi.listPaymentMethods();
    },
    enabled: !!selectedTenant?.id,
  });

  useEffect(() => {
    if (!config) return;
    setEnabled(config.enabled);
    if (config.thresholdAmount !== undefined) {
      setThresholdAmount(String(config.thresholdAmount));
    }
    if (config.packageId) setPackageId(config.packageId);
    if (config.currency) setSelectedCurrency(config.currency);
    if (config.paymentMethodId) setPaymentMethodId(config.paymentMethodId);
  }, [config]);

  useEffect(() => {
    const methods = paymentMethods?.data ?? [];
    if (!paymentMethodId && methods.length > 0) {
      const defaultMethod = methods.find((method) => method.isDefault) ?? methods[0];
      setPaymentMethodId(defaultMethod.id);
    }
  }, [paymentMethods, paymentMethodId]);

  const saveMutation = useMutation({
    mutationFn: () =>
      billingApi.configureAutoTopup({
        enabled,
        thresholdAmount: Number(thresholdAmount),
        packageId,
        currency: selectedCurrency,
        paymentMethodId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['auto-topup-config'] });
    },
  });

  const setupCardMutation = useMutation({
    mutationFn: () => billingApi.startPaymentMethodSetup(selectedCurrency),
    onSuccess: (result) => {
      window.location.href = result.checkoutUrl;
    },
  });

  const methods = paymentMethods?.data ?? [];
  const isLoading = configLoading || methodsLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auto top-up</CardTitle>
        <CardDescription>
          When your token balance drops below a threshold, we charge your saved card and add a token
          pack automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Enable auto top-up</p>
            <p className="text-sm text-muted-foreground">
              Requires a saved card through Nomba (NGN) or Polar (USD).
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={isLoading} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="threshold">Top up when balance is at or below</Label>
            <Input
              id="threshold"
              type="number"
              min={0}
              value={thresholdAmount}
              onChange={(event) => setThresholdAmount(event.target.value)}
              disabled={!enabled || isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Billing currency</Label>
            <Select
              value={selectedCurrency}
              onValueChange={(value) => setSelectedCurrency(value as 'USD' | 'NGN')}
              disabled={!enabled || isLoading}
            >
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="NGN">NGN</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="package">Token pack to purchase</Label>
            <Select
              value={packageId}
              onValueChange={setPackageId}
              disabled={!enabled || isLoading || managedPackages.length === 0}
            >
              <SelectTrigger id="package">
                <SelectValue placeholder="Select a pack" />
              </SelectTrigger>
              <SelectContent>
                {managedPackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.tokens.toLocaleString()} tokens —{' '}
                    {pkg.currency === 'NGN' ? `₦${pkg.price.toLocaleString()}` : `$${pkg.price}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Saved card</p>
              <p className="text-sm text-muted-foreground">
                Add a card once. We use it only when your balance hits the threshold.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setupCardMutation.mutate()}
              disabled={setupCardMutation.isPending}
            >
              {setupCardMutation.isPending ? 'Redirecting…' : 'Add card'}
            </Button>
          </div>

          {methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved cards yet.</p>
          ) : (
            <Select
              value={paymentMethodId}
              onValueChange={setPaymentMethodId}
              disabled={!enabled || isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved card" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {(method.cardBrand ?? method.provider).toUpperCase()} ••••{' '}
                    {method.cardLast4 ?? '****'} ({method.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading || (enabled && !paymentMethodId)}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save auto top-up settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
