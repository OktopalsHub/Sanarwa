'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenant } from '@/contexts/tenant-context';
import { Tenant } from '@/lib/types/tenant';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownTrayIcon, BookmarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { TenantBillingSettings } from './tenant-billing-settings';
import { TenantDangerZone } from './tenant-danger-zone';
import { TenantFeatureToggles } from './tenant-feature-toggles';

const tenantProfileSchema = z.object({
  name: z.string().min(1, 'Tenant name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
});

const tenantSettingsSchema = z.object({
  allowMemberInvites: z.boolean(),
  requireEmailVerification: z.boolean(),
  maxMembers: z.number().min(1).max(1000),
});

type TenantProfileForm = z.infer<typeof tenantProfileSchema>;
type TenantSettingsForm = z.infer<typeof tenantSettingsSchema>;

interface TenantSettingsProps {
  tenant: Tenant;
}

export function TenantSettings({ tenant }: TenantSettingsProps) {
  const { updateTenant, isLoading } = useTenant();
  const [isExporting, setIsExporting] = useState(false);

  const profileForm = useForm<TenantProfileForm>({
    resolver: zodResolver(tenantProfileSchema),
    defaultValues: {
      name: tenant.name,
      slug: tenant.slug,
    },
  });

  const settingsForm = useForm<TenantSettingsForm>({
    resolver: zodResolver(tenantSettingsSchema),
    defaultValues: {
      allowMemberInvites: tenant.settings?.allowMemberInvites || false,
      requireEmailVerification: tenant.settings?.requireEmailVerification || false,
      maxMembers: tenant.settings?.maxMembers || 10,
    },
  });

  const handleProfileSubmit = async (data: TenantProfileForm) => {
    try {
      await updateTenant(tenant.id, {
        name: data.name,
        slug: data.slug,
      });
      toast.success('Tenant profile updated successfully');
    } catch (error) {
      toast.error('Failed to update tenant profile');
      console.error('Profile update error:', error);
    }
  };

  const handleSettingsSubmit = async (data: TenantSettingsForm) => {
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...tenant.settings,
          ...data,
        },
      });
      toast.success('Tenant settings updated successfully');
    } catch (error) {
      toast.error('Failed to update tenant settings');
      console.error('Settings update error:', error);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // This would typically call an API endpoint to generate and download tenant data
      const response = await fetch(`/api/tenants/${tenant.id}/export`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tenant.slug}-data-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data export completed successfully');
    } catch (error) {
      toast.error('Failed to export data');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
        <TabsTrigger value="danger">Danger Zone</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Profile</CardTitle>
            <CardDescription>
              Update your organization's basic information and settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input
                    id="name"
                    {...profileForm.register('name')}
                    placeholder="Enter organization name"
                  />
                  {profileForm.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {profileForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug</Label>
                  <Input
                    id="slug"
                    {...profileForm.register('slug')}
                    placeholder="organization-slug"
                  />
                  {profileForm.formState.errors.slug && (
                    <p className="text-sm text-destructive">
                      {profileForm.formState.errors.slug.message}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This will be used in your organization's URL: app.notifi.com/{profileForm.watch('slug')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Created</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Last Updated</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(tenant.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !profileForm.formState.isDirty}
                className="w-full sm:w-auto"
              >
                <BookmarkIcon className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Export</CardTitle>
            <CardDescription>
              Export all your organization's data for backup or migration purposes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will generate a comprehensive export of all your organization's data including:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Campaign data and analytics</li>
                <li>Workflow configurations</li>
                <li>Template library</li>
                <li>Team member information</li>
                <li>Branding and settings</li>
              </ul>
              <Button
                onClick={handleExportData}
                disabled={isExporting}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export Data'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
            <CardDescription>
              Configure how your organization operates and manages members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={settingsForm.handleSubmit(handleSettingsSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowMemberInvites">Allow Member Invitations</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow team members to invite new members to the organization
                    </p>
                  </div>
                  <Switch
                    id="allowMemberInvites"
                    checked={settingsForm.watch('allowMemberInvites')}
                    onCheckedChange={(checked) => settingsForm.setValue('allowMemberInvites', checked)}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requireEmailVerification">Require Email Verification</Label>
                    <p className="text-sm text-muted-foreground">
                      Require new members to verify their email before accessing the platform
                    </p>
                  </div>
                  <Switch
                    id="requireEmailVerification"
                    checked={settingsForm.watch('requireEmailVerification')}
                    onCheckedChange={(checked) => settingsForm.setValue('requireEmailVerification', checked)}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="maxMembers">Maximum Members</Label>
                  <Input
                    id="maxMembers"
                    type="number"
                    min="1"
                    max="1000"
                    {...settingsForm.register('maxMembers', { valueAsNumber: true })}
                    className="w-32"
                  />
                  {settingsForm.formState.errors.maxMembers && (
                    <p className="text-sm text-destructive">
                      {settingsForm.formState.errors.maxMembers.message}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Maximum number of members allowed in this organization
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !settingsForm.formState.isDirty}
                className="w-full sm:w-auto"
              >
                <BookmarkIcon className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="features">
        <TenantFeatureToggles tenant={tenant} />
      </TabsContent>

      <TabsContent value="billing">
        <TenantBillingSettings tenant={tenant} />
      </TabsContent>

      <TabsContent value="danger">
        <TenantDangerZone tenant={tenant} />
      </TabsContent>
    </Tabs>
  );
}