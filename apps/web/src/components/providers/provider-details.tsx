'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { providerApi } from '@/lib/api/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cog6ToothIcon, ChartBarIcon, SignalIcon, ExclamationCircleIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { ProviderConfiguration } from './provider-configuration';
import { ProviderMetrics } from './provider-metrics';
import { ProviderHealthCheck } from './provider-health-check';
import { toast } from 'sonner';

interface ProviderDetailsProps {
  providerId: string;
}

export function ProviderDetails({ providerId }: ProviderDetailsProps) {
  const [activeTab, setActiveTab] = useState('configuration');
  const [isTesting, setIsTesting] = useState(false);

  const { data: provider, isLoading, error } = useQuery({
    queryKey: ['provider', providerId],
    queryFn: () => providerApi.getProvider(providerId),
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'testing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'unhealthy':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const handleTestProvider = async () => {
    if (!provider) return;

    setIsTesting(true);
    try {
      const result = await providerApi.testProvider(providerId);
      if (result.success) {
        toast.success('Provider test successful');
      } else {
        toast.error(`Provider test failed: ${result.message}`);
      }
    } catch (error: any) {
      toast.error(`Provider test failed: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="h-4 bg-muted rounded w-3/4"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !provider) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <ExclamationCircleIcon className="h-8 w-8 mx-auto mb-2" />
            <p>Failed to load provider details. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Provider Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{provider.name}</CardTitle>
                <Badge className={getStatusColor(provider.status)}>
                  {provider.status}
                </Badge>
                <Badge className={getHealthColor(provider.healthStatus)}>
                  {provider.healthStatus}
                </Badge>
                {provider.isDefault && (
                  <Badge variant="outline">Default</Badge>
                )}
              </div>
              <CardDescription className="text-base">
                {provider.type} • {provider.subtype}
                {provider.description && ` • ${provider.description}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestProvider}
                disabled={isTesting}
              >
                <BeakerIcon className="h-4 w-4 mr-2" />
                {isTesting ? 'Testing...' : 'Test'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">
                {new Date(provider.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Used</p>
              <p className="font-medium">
                {provider.lastUsed
                  ? new Date(provider.lastUsed).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Success Rate</p>
              <p className="font-medium">{(provider.successRate * 100).toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Priority</p>
              <p className="font-medium">{provider.priority}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configuration">
            <Cog6ToothIcon className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="health">
            <SignalIcon className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6">
          <ProviderConfiguration provider={provider} />
        </TabsContent>

        <TabsContent value="metrics">
          <ProviderMetrics providerId={providerId} />
        </TabsContent>

        <TabsContent value="health">
          <ProviderHealthCheck providerId={providerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}