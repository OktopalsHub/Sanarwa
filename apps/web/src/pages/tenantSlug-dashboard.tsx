"use client";

import { DashboardOverview } from "@/components/dashboard";
import { AppShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useEnsureTenantFromSlug, useTenantBasePath } from "@/hooks/use-tenant-slug";
import { useTenant } from "@/contexts/tenant-context";
import Link from "@/compat/next-link";
import { useNavigate } from "@tanstack/react-router";

export default function TenantDashboardPage() {
  const navigate = useNavigate();
  const basePath = useTenantBasePath();
  const { matchedTenant, isLoading } = useEnsureTenantFromSlug();
  const { selectedTenant } = useTenant();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
            role="status"
            aria-label="Loading dashboard"
          />
        </div>
      </AppShell>
    );
  }

  if (!matchedTenant && !selectedTenant) {
    return (
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Workspace not found</h1>
            <p className="text-sm text-muted-foreground">
              This URL does not match any workspace you can access.
            </p>
            <Button type="button" onClick={() => navigate({ to: "/onboarding" })}>
              Set up workspace
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const tenant = selectedTenant || matchedTenant;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{tenant?.name}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Delivery and sending activity · last 30 days</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}/messages`}>Messages</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`${basePath}/analytics`}>Analytics</Link>
            </Button>
          </div>
        </header>

        <DashboardOverview />
      </div>
    </AppShell>
  );
}
