"use client";

import { Card } from "@/components/ui/card";
import {
  SignalIcon,
  CpuChipIcon,
  CircleStackIcon,
  GlobeAltIcon,
  ServerIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

interface SystemMetrics {
  cpu: number;
  memory: number;
  latency: number;
  requests: number;
  uptime: number;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: 45,
    memory: 62,
    latency: 124,
    requests: 1250,
    uptime: 99.99,
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        cpu: Math.min(100, Math.max(0, prev.cpu + (Math.random() * 10 - 5))),
        memory: Math.min(100, Math.max(0, prev.memory + (Math.random() * 5 - 2.5))),
        latency: Math.max(20, prev.latency + (Math.random() * 20 - 10)),
        requests: Math.max(0, prev.requests + Math.floor(Math.random() * 50 - 20)),
        uptime: 99.99,
      }));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (value: number, type: "cpu" | "memory" | "latency") => {
    if (type === "cpu" || type === "memory") {
      if (value > 90) return "text-red-500";
      if (value > 70) return "text-yellow-500";
      return "text-emerald-500";
    }
    // Latency
    if (value > 500) return "text-red-500";
    if (value > 200) return "text-yellow-500";
    return "text-emerald-500";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <Card className="glass border-border/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">CPU Usage</p>
            <h3 className="mt-2 text-2xl font-bold">{metrics.cpu.toFixed(1)}%</h3>
          </div>
          <div className={`bg-muted/30 rounded-full p-3 ${getStatusColor(metrics.cpu, "cpu")}`}>
            <CpuChipIcon className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs">
          <ArrowUpIcon className="text-red-500 h-3 w-3 mr-1" />
          <span className="text-muted-foreground">+2.5% from last minute</span>
        </div>
        <div className="bg-muted/30 mt-4 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-500"
            style={{ width: `${metrics.cpu}%` }}
          />
        </div>
      </Card>

      <Card className="glass border-border/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Memory Usage</p>
            <h3 className="mt-2 text-2xl font-bold">{metrics.memory.toFixed(1)}%</h3>
          </div>
          <div
            className={`bg-muted/30 rounded-full p-3 ${getStatusColor(metrics.memory, "memory")}`}
          >
            <CircleStackIcon className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs">
          <ArrowDownIcon className="text-emerald-500 h-3 w-3 mr-1" />
          <span className="text-muted-foreground">-1.2% from last minute</span>
        </div>
        <div className="bg-muted/30 mt-4 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-500"
            style={{ width: `${metrics.memory}%` }}
          />
        </div>
      </Card>

      <Card className="glass border-border/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Avg Latency</p>
            <h3 className="mt-2 text-2xl font-bold">{metrics.latency.toFixed(0)}ms</h3>
          </div>
          <div
            className={`bg-muted/30 rounded-full p-3 ${getStatusColor(metrics.latency, "latency")}`}
          >
            <SignalIcon className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs">
          <span className="text-muted-foreground">Global average</span>
        </div>
        <div className="bg-muted/30 mt-4 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-500"
            style={{ width: `${(metrics.latency / 1000) * 100}%` }}
          />
        </div>
      </Card>

      <Card className="glass border-border/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Active Requests</p>
            <h3 className="mt-2 text-2xl font-bold">{metrics.requests.toLocaleString()}</h3>
          </div>
          <div className="bg-muted/30 text-primary rounded-full p-3">
            <GlobeAltIcon className="h-6 w-6" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs">
          <ServerIcon className="text-muted-foreground h-3 w-3 mr-1" />
          <span className="text-muted-foreground">Across 3 regions</span>
        </div>
        <div className="bg-muted/30 mt-4 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-500 animate-pulse"
            style={{ width: "100%" }}
          />
        </div>
      </Card>
    </div>
  );
}
