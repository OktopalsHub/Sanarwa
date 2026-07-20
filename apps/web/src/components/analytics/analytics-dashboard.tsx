'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateRange, DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartBarIcon, ArrowDownTrayIcon, FunnelIcon, ChatBubbleLeftRightIcon, ArrowTrendingUpIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { CampaignAnalytics } from './campaign-analytics';
import { ChannelAnalytics } from './channel-analytics';

type AnalyticsView = 'overview' | 'campaigns' | 'channels' | 'audience';

export function AnalyticsDashboard() {
  const [currentView, setCurrentView] = useState<AnalyticsView>('overview');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const handleExportAll = () => {
    // TODO: Implement data export functionality
    alert('Export functionality will be implemented soon');
  };

  const renderViewContent = () => {
    switch (currentView) {
      case 'campaigns':
        return <CampaignAnalytics />;
      case 'channels':
        return <ChannelAnalytics />;
      case 'audience':
        return (
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Audience Analytics</h3>
            <p className="text-muted-foreground">
              Audience analytics will be implemented in a future update.
            </p>
          </Card>
        );
      default:
        return (
          <div className="space-y-6">
            <CampaignAnalytics />
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Channel Performance</h2>
              <ChannelAnalytics />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into your communication performance
          </p>
        </div>
        <Button onClick={handleExportAll} variant="outline">
          <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
          Export All Data
        </Button>
      </div>

      {/* Navigation Tabs */}
      <Card className="p-1">
        <div className="flex space-x-1">
          <Button
            variant={currentView === 'overview' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('overview')}
            className="flex items-center space-x-2"
          >
            <ChartBarIcon className="h-4 w-4" />
            <span>Overview</span>
          </Button>
          <Button
            variant={currentView === 'campaigns' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('campaigns')}
            className="flex items-center space-x-2"
          >
            <ArrowTrendingUpIcon className="h-4 w-4" />
            <span>Campaigns</span>
          </Button>
          <Button
            variant={currentView === 'channels' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('channels')}
            className="flex items-center space-x-2"
          >
            <ChatBubbleLeftRightIcon className="h-4 w-4" />
            <span>Channels</span>
          </Button>
          <Button
            variant={currentView === 'audience' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setCurrentView('audience')}
            className="flex items-center space-x-2"
          >
            <UsersIcon className="h-4 w-4" />
            <span>Audience</span>
          </Button>
        </div>
      </Card>

      {/* Global Filters (only show for overview) */}
      {currentView === 'overview' && (
        <Card className="p-6">
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <DateRangePicker
                value={dateRange}
                onChange={setDateRange}
                className="w-full md:w-64"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Tenant</label>
              <Select defaultValue="current">
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Tenant</SelectItem>
                  <SelectItem value="all">All Tenants</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <FunnelIcon className="h-4 w-4 mr-2" />
                Advanced Filters
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {renderViewContent()}
    </div>
  );
}