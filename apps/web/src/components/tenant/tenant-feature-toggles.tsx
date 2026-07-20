'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useTenant } from '@/contexts/tenant-context';
import { Tenant, TenantFeatures } from '@/lib/types/tenant';
import { BookmarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { toast } from 'sonner';

interface TenantFeatureTogglesProps {
  tenant: Tenant;
}

interface FeatureConfig {
  key: keyof TenantFeatures;
  label: string;
  description: string;
  requiresPro?: boolean;
}

const features: FeatureConfig[] = [
  {
    key: 'campaigns',
    label: 'Campaign Management',
    description: 'Create and manage multi-channel communication campaigns',
  },
  {
    key: 'workflows',
    label: 'Workflow Builder',
    description: 'Build automated communication workflows with drag-and-drop interface',
  },
  {
    key: 'analytics',
    label: 'Advanced Analytics',
    description: 'Access detailed analytics and reporting for campaigns and workflows',
    requiresPro: true,
  },
  {
    key: 'templates',
    label: 'Template Library',
    description: 'Create and manage reusable templates for all communication channels',
  },
  {
    key: 'branding',
    label: 'Custom Branding',
    description: 'Customize the platform appearance with your brand colors and logo',
    requiresPro: true,
  },
  {
    key: 'apiAccess',
    label: 'API Access',
    description: 'Access to REST API and webhooks for custom integrations',
    requiresPro: true,
  },
];

export function TenantFeatureToggles({ tenant }: TenantFeatureTogglesProps) {
  const { updateTenant, isLoading } = useTenant();
  const [localFeatures, setLocalFeatures] = useState<TenantFeatures>(tenant.settings?.features || {
    campaigns: false,
    workflows: false,
    analytics: false,
    templates: false,
    branding: false,
    apiAccess: false,
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleFeatureToggle = (featureKey: keyof TenantFeatures, enabled: boolean) => {
    const feature = features.find(f => f.key === featureKey);

    // Check if feature requires pro plan
    if (enabled && feature?.requiresPro && (tenant.subscription || 'free') !== 'pro' && (tenant.subscription || 'free') !== 'enterprise') {
      toast.error('This feature requires a Pro or Enterprise subscription');
      return;
    }

    setLocalFeatures(prev => ({
      ...prev,
      [featureKey]: enabled,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateTenant(tenant.id, {
        settings: {
          ...tenant.settings,
          features: localFeatures,
        },
      });
      setHasChanges(false);
      toast.success('Feature settings updated successfully');
    } catch (error) {
      toast.error('Failed to update feature settings');
      console.error('Feature update error:', error);
    }
  };

  const handleReset = () => {
    setLocalFeatures(tenant.settings?.features || {
      campaigns: false,
      workflows: false,
      analytics: false,
      templates: false,
      branding: false,
      apiAccess: false,
    });
    setHasChanges(false);
  };

  const getSubscriptionBadge = (subscription: string) => {
    const badges = {
      free: { label: 'Free', className: 'bg-gray-100 text-gray-800' },
      pro: { label: 'Pro', className: 'bg-orange-100 text-orange-800' },
      enterprise: { label: 'Enterprise', className: 'bg-purple-100 text-purple-800' },
    };

    const badge = badges[subscription as keyof typeof badges] || badges.free;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Feature Configuration</CardTitle>
            <CardDescription>
              Enable or disable features for your organization. Some features require a Pro subscription.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current Plan:</span>
            {getSubscriptionBadge(tenant.subscription || 'free')}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {features.map((feature, index) => {
            const isEnabled = localFeatures[feature.key];
            const isDisabled = feature.requiresPro &&
              tenant.subscription !== 'pro' &&
              tenant.subscription !== 'enterprise';

            return (
              <div key={feature.key}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{feature.label}</span>
                      {feature.requiresPro && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Pro
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                    {isDisabled && (
                      <p className="text-xs text-amber-600">
                        Upgrade to Pro to enable this feature
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleFeatureToggle(feature.key, checked)}
                    disabled={isDisabled}
                  />
                </div>
                {index < features.length - 1 && <Separator className="mt-4" />}
              </div>
            );
          })}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 sm:flex-none"
            >
              <BookmarkIcon className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              disabled={isLoading}
              className="flex-1 sm:flex-none"
            >
              Reset
            </Button>
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium mb-2">Feature Usage Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Enabled Features:</span>
              <span className="ml-2 font-medium">
                {Object.values(localFeatures).filter(Boolean).length} / {features.length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Pro Features:</span>
              <span className="ml-2 font-medium">
                {features.filter(f => f.requiresPro && localFeatures[f.key]).length} / {features.filter(f => f.requiresPro).length}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}