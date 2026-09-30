"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "@/compat/next-navigation";
import { BillingOverview } from "@/components/billing/billing-overview";
import { AutoTopupSettings } from "@/components/billing/auto-topup-settings";
import { TokenPacks } from "@/components/billing/subscription-plans";
import { BillingHistory } from "@/components/billing/billing-history";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { billingApi } from "@/lib/api";
import { CreditCardIcon, CubeIcon, ClockIcon } from "@heroicons/react/24/outline";

function CheckoutStatusBanner() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const purchaseId = searchParams.get("purchase_id") ?? searchParams.get("checkout_id");

  const { data: purchaseStatus } = useQuery({
    queryKey: ["billing", "purchase-status", purchaseId, checkout],
    queryFn: async () => {
      if (!purchaseId || checkout !== "success") return null;
      try {
        const s = await billingApi.getPurchaseStatus(purchaseId);
        if (s.status === "completed" || s.status === "failed") return s;
      } catch {}
      // poll fallback via sync after 30s
      return billingApi.syncPurchase(purchaseId).catch(() => null);
    },
    enabled: checkout === "success" && !!purchaseId,
    refetchInterval: (query) => (query.state.data?.status === "completed" || query.state.data?.status === "failed" ? false : 2500),
    staleTime: 0,
  });

  if (checkout === "cancel") {
    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <p className="font-medium">Checkout cancelled</p>
        <p className="mt-1 text-muted-foreground">Checkout was cancelled. You can pick a pack and try again.</p>
      </div>
    );
  }
  if (checkout !== "success") return null;
  if (!purchaseId) return null;

  const status = purchaseStatus?.status;
  const message =
    status === "completed"
      ? "Payment confirmed. Your token balance has been updated."
      : status === "failed"
        ? "Payment failed. Please contact support if you were charged."
        : purchaseStatus
          ? "Payment is still processing. Your balance will update shortly once confirmation completes."
          : "Payment received — confirming your token purchase…";
  const variant = status === "failed" ? "destructive" : "default";

  if (!message) {
    return null;
  }

  return (
    <div
      className={
        variant === "destructive"
          ? "rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
          : "rounded-lg border bg-muted/40 px-4 py-3 text-sm"
      }
    >
      <p className="font-medium">Checkout status</p>
      <p className="mt-1 text-muted-foreground">{message}</p>
    </div>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("checkout") ? "packs" : "overview";

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
