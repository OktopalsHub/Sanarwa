'use client';

import { BillingOverview } from '@/components/billing/billing-overview';
import { TokenPacks } from '@/components/billing/subscription-plans';
import { BillingHistory } from '@/components/billing/billing-history';
import { AppShell } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCardIcon, CubeIcon, ClockIcon } from '@heroicons/react/24/outline';

export default function BillingPage() {
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

          <Tabs defaultValue="overview" className="space-y-6">
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

            <TabsContent value="overview">
              <BillingOverview />
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
