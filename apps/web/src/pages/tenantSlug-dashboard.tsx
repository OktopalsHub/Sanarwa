"use client";

import { DashboardOverview } from "@/components/dashboard";
import { AdvancedDashboard } from "@/components/dashboard/advanced-dashboard";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnsureTenantFromSlug } from "@/hooks/use-tenant-slug";
import { useTenant } from "@/contexts/tenant-context";
import { ChartBarIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { useNavigate } from "@tanstack/react-router";

export default function TenantDashboardPage() {
  const navigate = useNavigate();
  const { matchedTenant, isLoading } = useEnsureTenantFromSlug();
  const { selectedTenant } = useTenant();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </div>
      </AppShell>
    );
  }

  if (!matchedTenant && !selectedTenant) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Tenant not found</h1>
            <button
              type="button"
              onClick={() => navigate({ to: "/onboarding" })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Set up workspace
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const tenant = selectedTenant || matchedTenant;

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {tenant?.name} Dashboard
              </h1>
              <p className="text-muted-foreground">
                Sends, delivery, and setup for this workspace.
              </p>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="overview" className="gap-2">
                <Squares2X2Icon className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="advanced" className="gap-2">
                <ChartBarIcon className="h-4 w-4" />
                Advanced
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <DashboardOverview />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-6">
              <AdvancedDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
