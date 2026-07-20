'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { alertManager } from '@/lib/services/alert-manager';
import { toast } from '@/lib/utils/toast';
import { ExclamationTriangleIcon, BellIcon, CheckCircleIcon, ClockIcon, XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react';

interface Alert {
  id: string;
  type: 'error' | 'performance' | 'security' | 'availability' | 'user_experience' | 'business_metric';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  context: Record<string, any>;
  resolved: boolean;
  resolvedAt?: number;
}

interface RealTimeAlertsProps {
  maxAlerts?: number;
  autoHide?: boolean;
  showNotifications?: boolean;
}

export default function RealTimeAlerts({
  maxAlerts = 10,
  autoHide = true,
  showNotifications = true
}: RealTimeAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isEnabled) return;

    // Simulate real-time alerts (in production, this would be WebSocket or SSE)
    const interval = setInterval(() => {
      // Randomly generate alerts for demonstration
      if (Math.random() < 0.1) { // 10% chance every 5 seconds
        generateRandomAlert();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isEnabled]);

  const generateRandomAlert = () => {
    const alertTypes: Alert['type'][] = ['error', 'performance', 'security', 'availability', 'user_experience', 'business_metric'];
    const severities: Alert['severity'][] = ['low', 'medium', 'high', 'critical'];

    const messages = {
      error: [
        'High error rate detected in campaign builder',
        'JavaScript error in workflow editor',
        'API endpoint returning 500 errors',
        'Database connection timeout',
      ],
      performance: [
        'API response time above threshold',
        'Memory usage exceeding 80%',
        'Slow database queries detected',
        'High CPU usage on server',
      ],
      security: [
        'Multiple failed login attempts detected',
        'Suspicious API access pattern',
        'Potential SQL injection attempt',
        'Unauthorized access attempt',
      ],
      availability: [
        'Service health check failed',
        'Database connection lost',
        'External API unavailable',
        'Load balancer health check failing',
      ],
      user_experience: [
        'High bounce rate detected',
        'Increased user dropoff in signup flow',
        'Slow page load times reported',
        'Mobile app crash rate increased',
      ],
      business_metric: [
        'Conversion rate below target',
        'Revenue target not met',
        'Customer acquisition cost increased',
        'Monthly active users declining',
      ],
    };

    const type = alertTypes[Math.floor(Math.random() * alertTypes.length)]!;
    const severity = severities[Math.floor(Math.random() * severities.length)]!;
    const message = messages[type]?.[Math.floor(Math.random() * messages[type].length)] || 'Unknown alert';

    const newAlert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      context: {
        source: 'real-time-monitoring',
        threshold: Math.random() * 100,
        currentValue: Math.random() * 150,
      },
      resolved: false,
    };

    addAlert(newAlert);
  };

  const addAlert = (alert: Alert) => {
    setAlerts(prev => {
      const updated = [alert, ...prev].slice(0, maxAlerts);
      return updated;
    });

    setUnreadCount(prev => prev + 1);

    // Show toast notification for high/critical alerts
    if (showNotifications && ['high', 'critical'].includes(alert.severity)) {
      const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
      toast.error(`${icon} ${alert.message}`, {
        duration: alert.severity === 'critical' ? 10000 : 5000,
      });
    }

    // Auto-resolve some alerts after a delay (simulation)
    if (autoHide && Math.random() < 0.3) {
      setTimeout(() => {
        resolveAlert(alert.id);
      }, 30000 + Math.random() * 60000); // 30-90 seconds
    }
  };

  const resolveAlert = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, resolved: true, resolvedAt: Date.now() }
          : alert
      )
    );

    // Also resolve in alert manager
    alertManager.resolveAlert(alertId);
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
    setUnreadCount(0);
  };

  const markAllAsRead = () => {
    setUnreadCount(0);
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'high': return <ExclamationTriangleIcon className="h-4 w-4 text-orange-500" />;
      case 'medium': return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'low': return <CheckCircleIcon className="h-4 w-4 text-blue-500" />;
      default: return <ExclamationTriangleIcon className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: Alert['type']) => {
    switch (type) {
      case 'error': return 'text-red-600';
      case 'performance': return 'text-orange-600';
      case 'security': return 'text-purple-600';
      case 'availability': return 'text-blue-600';
      case 'user_experience': return 'text-green-600';
      case 'business_metric': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const activeAlerts = alerts.filter(alert => !alert.resolved);
  const resolvedAlerts = alerts.filter(alert => alert.resolved);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="flex items-center space-x-2">
              <BellIcon className="h-5 w-5" />
              <span>Real-time Alerts</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEnabled(!isEnabled)}
            >
              {isEnabled ? <BellIcon className="h-4 w-4" /> : <BellIcon className="h-4 w-4" />}
              {isEnabled ? 'Disable' : 'Enable'}
            </Button>
            {alerts.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllAlerts}>
                Clear All
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead}>
                Mark Read
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Live monitoring alerts and system notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {isEnabled ? 'No alerts at this time' : 'Alert monitoring is disabled'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2 text-orange-500" />
                  Active Alerts ({activeAlerts.length})
                </h4>
                <div className="space-y-2">
                  {activeAlerts.map((alert) => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onResolve={resolveAlert}
                      onDismiss={dismissAlert}
                      getSeverityColor={getSeverityColor}
                      getSeverityIcon={getSeverityIcon}
                      getTypeColor={getTypeColor}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Resolved Alerts */}
            {resolvedAlerts.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <CheckCircleIcon className="h-4 w-4 mr-2 text-green-500" />
                  Resolved Alerts ({resolvedAlerts.length})
                </h4>
                <div className="space-y-2">
                  {resolvedAlerts.slice(0, 5).map((alert) => (
                    <AlertItem
                      key={alert.id}
                      alert={alert}
                      onResolve={resolveAlert}
                      onDismiss={dismissAlert}
                      getSeverityColor={getSeverityColor}
                      getSeverityIcon={getSeverityIcon}
                      getTypeColor={getTypeColor}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AlertItemProps {
  alert: Alert;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  getSeverityColor: (severity: Alert['severity']) => string;
  getSeverityIcon: (severity: Alert['severity']) => React.ReactNode;
  getTypeColor: (type: Alert['type']) => string;
}

function AlertItem({
  alert,
  onResolve,
  onDismiss,
  getSeverityColor,
  getSeverityIcon,
  getTypeColor
}: AlertItemProps) {
  return (
    <div className={`p-3 border rounded-lg ${alert.resolved ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getSeverityIcon(alert.severity)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <Badge variant={getSeverityColor(alert.severity) as any}>
                {alert.severity}
              </Badge>
              <Badge variant="outline" className={getTypeColor(alert.type)}>
                {alert.type}
              </Badge>
              {alert.resolved && (
                <Badge variant="outline" className="text-green-600">
                  resolved
                </Badge>
              )}
            </div>
            <p className="font-medium text-sm">{alert.message}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(alert.timestamp).toLocaleString()}
              {alert.resolvedAt && (
                <span className="ml-2">
                  • Resolved {new Date(alert.resolvedAt).toLocaleString()}
                </span>
              )}
            </p>
            {Object.keys(alert.context).length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-muted-foreground">
                  View Details
                </summary>
                <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                  {JSON.stringify(alert.context, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 ml-2">
          {!alert.resolved && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResolve(alert.id)}
            >
              <CheckCircleIcon className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDismiss(alert.id)}
          >
            <XMarkIcon className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}