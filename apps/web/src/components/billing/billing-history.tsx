'use client';

import { apiClient } from '@/lib/api/client';
import { billingApi } from '@/lib/api';
import { useTenant } from '@/contexts/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BillingHistory() {
  const { selectedTenant } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ['billing-transactions', selectedTenant?.id],
    queryFn: async () => {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      return billingApi.getTransactions({ limit: 50 });
    },
    enabled: !!selectedTenant?.id,
  });

  const transactions = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token history</CardTitle>
        <CardDescription>Purchases, grants, and usage deductions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{tx.description || tx.type}</p>
                  <p className="text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {tx.amount >= 0 ? '+' : ''}
                  {tx.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
