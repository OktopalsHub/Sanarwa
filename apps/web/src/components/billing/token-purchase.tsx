'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function TokenPurchase() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Purchase</CardTitle>
        <CardDescription>Buy additional message tokens for your account</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Token purchase options coming soon.</p>
      </CardContent>
    </Card>
  );
}
