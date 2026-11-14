"use client";

import { DashboardOverview } from "@/components/dashboard";
import { AppShell, PageContainer, PageHeader } from "@/components/layout";
import { Button } from "@sanarwa/ui/button";
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
      <PageContainer>
        <PageHeader
          title="Overview"
          description={`Delivery activity for ${tenant?.name ?? "your workspace"} over the last 30 days.`}
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}/messages`}>View messages</Link>
            </Button>
          }
        />

        <DashboardOverview />
      </PageContainer>
    </AppShell>
  );
}
