'use client';

import { Activity, User, Users } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignalIcon, ExclamationTriangleIcon, CheckCircleIcon, ServerIcon, ArrowTrendingDownIcon, ArrowTrendingUpIcon, UsersIcon, BoltIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react';

interface MonitoringMetrics {
  errors: {
    total: number;
    rate: number;
    critical: number;
    trend: 'up' | 'down' | 'stable';
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    slowRequests: number;
    trend: 'up' | 'down' | 'stable';
  };
  users: {
    activeUsers: number;
    sessionDuration: number;
    bounceRate: number;
    trend: 'up' | 'down' | 'stable';
  };
  availability: {
    uptime: number;
    incidents: number;
    lastIncident?: string;
  };
}

interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
}

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadMonitoringData();

    // Set up real-time updates
    const interval = setInterval(loadMonitoringData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadMonitoringData = async () => {
    try {
      // In a real implementation, you'd fetch this from your monitoring API
      // For now, we'll simulate the data
      const mockMetrics: MonitoringMetrics = {
        errors: {
          total: Math.floor(Math.random() * 50),
          rate: Math.random() * 0.05,
          critical: Math.floor(Math.random() * 5),
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
        },
        performance: {
          avgResponseTime: 200 + Math.random() * 300,
          p95ResponseTime: 500 + Math.random() * 1000,
          slowRequests: Math.floor(Math.random() * 20),
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
        },
        users: {
          activeUsers: 150 + Math.floor(Math.random() * 100),
          sessionDuration: 5 + Math.random() * 10,
          bounceRate: 0.2 + Math.random() * 0.3,
          trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as any,
        },
        availability: {
          uptime: 99.5 + Math.random() * 0.5,
          incidents: Math.floor(Math.random() * 3),
          lastIncident: Math.random() > 0.5 ? '2 hours ago' : undefined,
        },
      };

      const mockAlerts: Alert[] = [
        {
          id: '1',
          type: 'performance',
          severity: 'medium',
          message: 'API response time above threshold',
          timestamp: Date.now() - 300000,
          resolved: false,
        },
        {
          id: '2',
          type: 'error',
          severity: 'high',
          message: 'High error rate in campaign builder',
          timestamp: Date.now() - 600000,
          resolved: true,
        },
      ];

      setMetrics(mockMetrics);
      setAlerts(mockAlerts);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowTrendingUpIcon className="h-4 w-4 text-red-500" />;
      case 'down': return <ArrowTrendingDownIcon className="h-4 w-4 text-green-500" />;
      default: return <SignalIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load monitoring data</p>
        <Button onClick={loadMonitoringData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time monitoring and alerting dashboard
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdated?.toLocaleTimeString()}
          </p>
          <Button onClick={loadMonitoringData} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <ExclamationTriangleIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.errors.rate * 100).toFixed(2)}%
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {getTrendIcon(metrics.errors.trend)}
              <span>{metrics.errors.total} total errors</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <BoltIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(metrics.performance.avgResponseTime)}ms
            </div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {getTrendIcon(metrics.performance.trend)}
              <span>P95: {Math.round(metrics.performance.p95ResponseTime)}ms</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.users.activeUsers}</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              {getTrendIcon(metrics.users.trend)}
              <span>{metrics.users.sessionDuration.toFixed(1)}m avg session</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <ServerIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.availability.uptime.toFixed(2)}%</div>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <CheckCircleIcon className="h-3 w-3 text-green-500" />
              <span>{metrics.availability.incidents} incidents</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Monitoring */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Tracking</TabsTrigger>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                Current system alerts and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {alert.resolved ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
                        )}
                        <div>
                          <p className="font-medium">{alert.message}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={getSeverityColor(alert.severity) as any}>
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline">{alert.type}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Average</span>
                    <span>{Math.round(metrics.performance.avgResponseTime)}ms</span>
                  </div>
                  <Progress value={Math.min(metrics.performance.avgResponseTime / 10, 100)} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>95th Percentile</span>
                    <span>{Math.round(metrics.performance.p95ResponseTime)}ms</span>
                  </div>
                  <Progress value={Math.min(metrics.performance.p95ResponseTime / 20, 100)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Slow Requests</span>
                    <span className="font-medium">{metrics.performance.slowRequests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Memory Usage</span>
                    <span className="font-medium">72%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">CPU Usage</span>
                    <span className="font-medium">45%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Errors</span>
                    <span className="font-medium">{metrics.errors.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Critical Errors</span>
                    <span className="font-medium text-red-500">{metrics.errors.critical}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Error Rate</span>
                    <span className="font-medium">{(metrics.errors.rate * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Error Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">JavaScript Errors</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">API Errors</span>
                    <span className="font-medium">8</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Network Errors</span>
                    <span className="font-medium">3</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Campaign Builder</span>
                    <span className="font-medium">5</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Workflow Editor</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Template Editor</span>
                    <span className="font-medium">2</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Session Duration</span>
                    <span>{metrics.users.sessionDuration.toFixed(1)} minutes</span>
                  </div>
                  <Progress value={Math.min(metrics.users.sessionDuration * 10, 100)} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Bounce Rate</span>
                    <span>{(metrics.users.bounceRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.users.bounceRate * 100} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Active Users</span>
                    <span className="font-medium">{metrics.users.activeUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Page Views</span>
                    <span className="font-medium">1,234</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Feature Usage</span>
                    <span className="font-medium">89%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}