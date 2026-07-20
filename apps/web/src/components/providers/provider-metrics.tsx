'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { providerApi } from '@/lib/api/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, SignalIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface ProviderMetricsProps {
  providerId: string;
}

export function ProviderMetrics({ providerId }: ProviderMetricsProps) {
  const [timeRange, setTimeRange] = useState('7d');

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['provider-metrics', providerId, timeRange],
    queryFn: () => providerApi.getProviderMetrics(providerId, {
      startDate: new Date(Date.now() - (timeRange === '24h' ? 24 * 60 * 60 * 1000 :
        timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000 :
          timeRange === '30d' ? 30 * 24 * 60 * 60 * 1000 :
            90 * 24 * 60 * 60 * 1000)),
      endDate: new Date(),
      groupBy: timeRange === '24h' ? 'hour' : 'day',
    }),
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatPercentage = (num: number) => {
    return (num * 100).toFixed(1) + '%';
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return ms.toFixed(0) + 'ms';
    return (ms / 1000).toFixed(1) + 's';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <SignalIcon className="h-8 w-8 mx-auto mb-2" />
            <p>No metrics data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Provider Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Performance and usage statistics for this provider
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{formatNumber(metrics.totalRequests)}</p>
              </div>
              <div className="flex items-center gap-1">
                {(metrics.requestsTrend ?? 0) > 0 ? (
                  <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />
                )}
                <span className={`text-sm ${(metrics.requestsTrend ?? 0) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {Math.abs(metrics.requestsTrend ?? 0).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{formatPercentage(metrics.successRate)}</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
                <p className="text-2xl font-bold">{formatPercentage(metrics.errorRate ?? 0)}</p>
              </div>
              <XCircleIcon className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{formatDuration(metrics.averageResponseTime)}</p>
              </div>
              <ClockIcon className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Breakdown */}
      {metrics.errorBreakdown && metrics.errorBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Error Breakdown</CardTitle>
            <CardDescription>
              Most common errors encountered by this provider
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.errorBreakdown.map((error, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{error.type ?? error.error}</p>
                    <p className="text-sm text-muted-foreground">{error.message ?? error.error}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{error.count} occurrences</Badge>
                    <Badge variant="secondary">{formatPercentage(error.percentage)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>
            Historical performance data over the selected time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <SignalIcon className="h-8 w-8 mx-auto mb-2" />
            <p>Performance charts coming soon</p>
            <p className="text-sm">We're working on detailed performance visualizations</p>
          </div>
        </CardContent>
      </Card>

      {/* Usage by Time */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Distribution</CardTitle>
          <CardDescription>
            Request volume distribution over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <SignalIcon className="h-8 w-8 mx-auto mb-2" />
            <p>Usage charts coming soon</p>
            <p className="text-sm">Detailed usage analytics are being developed</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}