'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SendSnippet } from '@/components/messages/send-snippet';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useTenantBasePath } from '@/hooks/use-tenant-slug';
import { useTenant } from '@/contexts/tenant-context';
import { apiClient } from '@/lib/api/client';
import { providerApi } from '@/lib/api/provider';
import { projectApi } from '@/lib/api/project';
import { apiKeyApi } from '@/lib/api/api-key';
import { DashboardChart } from './dashboard-chart';
import { MetricCard } from './metric-card';
import {
  ChatBubbleLeftRightIcon,
  ExclamationCircleIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  InboxIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { useQuery } from '@tanstack/react-query';
import Link from '@/compat/next-link';

export function DashboardOverview() {
  const { data, isLoading } = useDashboardData();
  const basePath = useTenantBasePath();
  const { selectedTenant } = useTenant();

  const setup = useQuery({
    queryKey: ['dashboard-setup', selectedTenant?.id],
    queryFn: async () => {
      if (selectedTenant?.id) apiClient.setTenant(selectedTenant.id);
      const [providers, projects] = await Promise.all([
        providerApi.getProviders({ limit: 1 }).catch(() => ({ data: [] })),
        projectApi.getProjects({ limit: 5 }).catch(() => ({ data: [] })),
      ]);
      let keyCount = 0;
      for (const project of projects.data || []) {
        const keys = await apiKeyApi.getApiKeysByProject(project.id).catch(() => ({ data: [] }));
        keyCount += keys.data?.length || 0;
        if (keyCount > 0) break;
      }
      return {
        hasProvider: (providers.data?.length || 0) > 0,
        hasApiKey: keyCount > 0,
      };
    },
    enabled: !!selectedTenant?.id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse p-6">
              <div className="bg-muted mb-3 h-4 w-3/4 rounded-lg" />
              <div className="bg-muted h-8 w-1/2 rounded-lg" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics;
  const needsSetup = setup.data && (!setup.data.hasProvider || !setup.data.hasApiKey);
  const empty = !metrics || metrics.totalMessages === 0;

  return (
    <div className="space-y-6">
      {needsSetup ? (
        <Card className="border-dashed p-6">
          <h3 className="mb-4 text-lg font-semibold">Finish setup to send</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <SetupStep
              done={Boolean(setup.data?.hasProvider)}
              href={`${basePath}/providers`}
              label="Add a provider"
              detail="Email domain, SMS number, WhatsApp, or push."
            />
            <SetupStep
              done={Boolean(setup.data?.hasApiKey)}
              href={`${basePath}/api-keys`}
              label="Create an API key"
              detail="Authenticate POST /v1/messages from your app."
            />
          </div>
        </Card>
      ) : null}

      {empty ? (
        <Card className="space-y-4 border-dashed p-8">
          <div className="text-center">
            <InboxIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-semibold">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Send from your app. Delivery events show up in Messages.
            </p>
          </div>
          <SendSnippet />
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href={`${basePath}/messages`}>Open messages</Link>
            </Button>
            <Button asChild>
              <Link href={`${basePath}/providers`}>Add a provider</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Messages Sent"
              value={(metrics?.totalMessages ?? 0).toLocaleString()}
              icon={ChatBubbleLeftRightIcon}
              description="Last 30 days"
            />
            <MetricCard
              title="Delivery Rate"
              value={`${metrics?.deliveryRate ?? 0}%`}
              icon={ArrowTrendingUpIcon}
              description="Last 30 days"
            />
            <MetricCard
              title="Failed"
              value={metrics?.failed ?? 0}
              icon={ExclamationCircleIcon}
              description="Last 30 days"
            />
            <MetricCard
              title="Active Campaigns"
              value={metrics?.activeCampaigns ?? 0}
              icon={BoltIcon}
              description="Currently running"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DashboardChart
                title="Channel Distribution"
                data={data?.channelDistribution ?? []}
                type="pie"
                height={300}
              />
            </div>
            <Card className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Quick actions</h3>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/messages`}>
                    <InboxIcon className="mr-2 h-4 w-4" />
                    View messages
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/providers`}>
                    <BoltIcon className="mr-2 h-4 w-4" />
                    Manage providers
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/api-keys`}>
                    <KeyIcon className="mr-2 h-4 w-4" />
                    API keys
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link href={`${basePath}/analytics`}>View analytics</Link>
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function SetupStep({
  done,
  href,
  label,
  detail,
}: {
  done: boolean;
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start justify-between rounded-md border p-4 hover:bg-muted/40"
    >
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </div>
      <span className="text-sm text-muted-foreground">{done ? 'Done' : 'Set up'}</span>
    </Link>
  );
}
