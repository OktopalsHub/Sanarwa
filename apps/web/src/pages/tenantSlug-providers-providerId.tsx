"use client";

import { ProviderDetails } from "@/components/providers/provider-details";
import { AppShell } from "@/components/layout";
import { useRouter } from "@/compat/next-navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";

import { useTenantSlug } from "@/hooks/use-tenant-slug";
import { useParams } from "@tanstack/react-router";

export default function ProviderDetailPage() {
  const router = useRouter();
  const tenantSlug = useTenantSlug();
  const { providerId } = useParams({ strict: false }) as { providerId?: string };

  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${tenantSlug}/providers`)}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Providers
            </Button>
          </div>

          <ProviderDetails providerId={providerId || ""} />
        </div>
      </div>
    </AppShell>
  );
}
