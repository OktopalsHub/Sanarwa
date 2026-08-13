'use client';

import { AppShell } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TeamManagement } from '@/components/tenant/team-management';
import { BrandAssetManager } from '@/components/branding/brand-asset-manager';
import { BrandPreview } from '@/components/branding/brand-preview';
import { BrandTestingTool } from '@/components/branding/brand-testing-tool';
import { BrandingConfigurator } from '@/components/branding/branding-configurator';
import { useEnsureTenantFromSlug } from '@/hooks/use-tenant-slug';
import { useTenant } from '@/contexts/tenant-context';
import { useBranding } from '@/contexts/branding-context';

export default function TenantSettingsPage() {
  const { matchedTenant, isLoading } = useEnsureTenantFromSlug();
  const { selectedTenant } = useTenant();
  const tenant = selectedTenant || matchedTenant;
  const { branding, applyBranding } = useBranding();

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Workspace, team, and brand for {tenant?.name}
          </p>
        </div>

        <Tabs defaultValue="workspace">
          <TabsList>
            <TabsTrigger value="workspace">Workspace</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

          <TabsContent value="workspace" className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              Slug:{' '}
              <code className="font-mono">
                {tenant?.subdomain || tenant?.slug || tenant?.id}
              </code>
            </p>
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            {selectedTenant ? (
              <TeamManagement tenant={selectedTenant} />
            ) : (
              <p className="text-sm text-muted-foreground">Select a workspace to manage the team.</p>
            )}
          </TabsContent>

          <TabsContent value="branding" className="mt-6">
            {branding ? (
              <Tabs defaultValue="configurator">
                <TabsList>
                  <TabsTrigger value="configurator">Configuration</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="testing">Testing</TabsTrigger>
                  <TabsTrigger value="assets">Assets</TabsTrigger>
                </TabsList>
                <TabsContent value="configurator" className="mt-4">
                  <BrandingConfigurator />
                </TabsContent>
                <TabsContent value="preview" className="mt-4">
                  <BrandPreview branding={branding} />
                </TabsContent>
                <TabsContent value="testing" className="mt-4">
                  <BrandTestingTool branding={branding} />
                </TabsContent>
                <TabsContent value="assets" className="mt-4">
                  <BrandAssetManager
                    branding={branding}
                    onBrandingChange={(updates) =>
                      applyBranding({ ...branding, ...updates })
                    }
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground">Loading brand settings…</p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
