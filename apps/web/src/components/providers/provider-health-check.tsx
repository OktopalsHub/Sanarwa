"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { providerApi } from "@/lib/api/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  SignalIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

interface ProviderHealthCheckProps {
  providerId: string;
}

export function ProviderHealthCheck({ providerId }: ProviderHealthCheckProps) {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);

  const { data: healthStatus, isLoading } = useQuery({
    queryKey: ["provider-health", providerId],
    queryFn: () => providerApi.checkProviderHealth(providerId),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: healthHistory } = useQuery({
    queryKey: ["provider-health-history", providerId],
    queryFn: () =>
      providerApi.getProviderHealthHistory(providerId, {
        limit: 10,
      }),
  });

  const triggerHealthCheckMutation = useMutation({
    mutationFn: () => providerApi.triggerHealthCheck(providerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-health", providerId] });
      toast.success("Health check completed");
    },
    onError: (error: any) => {
      toast.error(`Health check failed: ${error.message}`);
    },
    onSettled: () => {
      setIsChecking(false);
    },
  });

  const handleManualHealthCheck = () => {
    setIsChecking(true);
    triggerHealthCheckMutation.mutate();
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "unhealthy":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-6 bg-muted rounded w-1/2"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Health Status</h3>
          <p className="text-sm text-muted-foreground">
            Monitor the health and availability of this provider
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleManualHealthCheck} disabled={isChecking}>
          <ArrowPathIcon className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "Checking..." : "Check Now"}
        </Button>
      </div>

      {/* Current Health Status */}
      {healthStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getHealthIcon(healthStatus.status)}
              Current Health Status
            </CardTitle>
            <CardDescription>
              Last checked: {new Date(healthStatus.checkedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Overall Status</span>
              <Badge className={getHealthColor(healthStatus.status)}>{healthStatus.status}</Badge>
            </div>

            {healthStatus.responseTime && (
              <div className="flex items-center justify-between">
                <span className="font-medium">Response Time</span>
                <span className="text-sm">{formatDuration(healthStatus.responseTime)}</span>
              </div>
            )}

            {healthStatus.message && (
              <div className="space-y-2">
                <span className="font-medium">Details</span>
                <p className="text-sm text-muted-foreground">{healthStatus.message}</p>
              </div>
            )}

            {healthStatus.details && Object.keys(healthStatus.details).length > 0 && (
              <div className="space-y-2">
                <span className="font-medium">Health Checks</span>
                <div className="space-y-2">
                  {Object.entries(healthStatus.details).map(([check, result]) => (
                    <div
                      key={check}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm capitalize">
                        {check.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <div className="flex items-center gap-2">
                        {typeof result === "object" && result !== null ? (
                          <>
                            {getHealthIcon((result as any).status)}
                            <span className="text-sm">
                              {(result as any).message || (result as any).status}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm">{String(result)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Health History */}
      <Card>
        <CardHeader>
          <CardTitle>Health History</CardTitle>
          <CardDescription>Recent health check results for this provider</CardDescription>
        </CardHeader>
        <CardContent>
          {healthHistory && healthHistory.length > 0 ? (
            <div className="space-y-3">
              {healthHistory.map((check, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getHealthIcon(check.status)}
                    <div>
                      <p className="font-medium">{new Date(check.checkedAt).toLocaleString()}</p>
                      {check.message && (
                        <p className="text-sm text-muted-foreground">{check.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getHealthColor(check.status)}>{check.status}</Badge>
                    {check.responseTime && (
                      <span className="text-sm text-muted-foreground">
                        {formatDuration(check.responseTime)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <SignalIcon className="h-8 w-8 mx-auto mb-2" />
              <p>No health check history available</p>
              <p className="text-sm">Health checks will appear here once they start running</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health Monitoring Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Settings</CardTitle>
          <CardDescription>
            Configure how health checks are performed for this provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Automatic Health Checks</h4>
                <p className="text-sm text-muted-foreground">
                  Automatically check provider health every 5 minutes
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Health Check Timeout</h4>
                <p className="text-sm text-muted-foreground">
                  Maximum time to wait for health check response
                </p>
              </div>
              <span className="text-sm">30 seconds</span>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h4 className="font-medium">Failure Threshold</h4>
                <p className="text-sm text-muted-foreground">
                  Number of consecutive failures before marking as unhealthy
                </p>
              </div>
              <span className="text-sm">3 failures</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
