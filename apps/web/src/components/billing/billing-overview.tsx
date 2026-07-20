'use client';

import { apiClient } from '@/lib/api/client';
import { billingApi } from '@/lib/api';
import { useTenant } from '@/contexts/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CurrencyDollarIcon } from '@heroicons/react/24/outline';

export function BillingOverview() {
  const { selectedTenant } = useTenant();

  const { data: balance, isLoading } = useQuery({
    queryKey: ['billing-balance', selectedTenant?.id],
    queryFn: async () => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      return billingApi.getTokenBalance();
    },
    enabled: !!selectedTenant?.id,
  });

  const available =
    (balance as { availableTokens?: number })?.availableTokens ??
    (balance as { balance?: number })?.balance ??
    0;
  const total =
    (balance as { totalTokens?: number })?.totalTokens ?? available;
  const used = (balance as { usedTokens?: number })?.usedTokens ?? 0;
  const usagePct = total > 0 ? (used / total) * 100 : 0;

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('en-US').format(num);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6 h-24 bg-muted/30 rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Available tokens</p>
                <p className="text-2xl font-bold">{formatNumber(available)}</p>
              </div>
              <CurrencyDollarIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Total purchased</p>
            <p className="text-2xl font-bold">{formatNumber(total)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Used</p>
            <p className="text-2xl font-bold">{formatNumber(used)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Token usage</CardTitle>
          <CardDescription>Pay-as-you-go token consumption for this workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Used: {formatNumber(used)}</span>
            <span>Total: {formatNumber(total)}</span>
          </div>
          <Progress value={Math.min(usagePct, 100)} className="h-2" />
        </CardContent>
      </Card>
    </div>
  );
}
