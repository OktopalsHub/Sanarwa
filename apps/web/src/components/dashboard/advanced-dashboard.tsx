"use client";

import { Send, User } from "@/lib/icons";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartBarIcon, ChartPieIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { CohortChart } from "./cohort-chart";
import { PerformanceMonitor } from "./performance-monitor";
import { UserJourneyMap } from "./user-journey-map";

// Mock data for demonstration
const MOCK_COHORT_DATA = [
  {
    date: "2023-01-01",
    totalUsers: 1250,
    retention: { "0": 100, "1": 45, "2": 38, "3": 32, "4": 30, "5": 28 },
  },
  {
    date: "2023-02-01",
    totalUsers: 1400,
    retention: { "0": 100, "1": 48, "2": 40, "3": 35, "4": 32 },
  },
  {
    date: "2023-03-01",
    totalUsers: 1600,
    retention: { "0": 100, "1": 50, "2": 42, "3": 38 },
  },
  {
    date: "2023-04-01",
    totalUsers: 1850,
    retention: { "0": 100, "1": 52, "2": 45 },
  },
  {
    date: "2023-05-01",
    totalUsers: 2100,
    retention: { "0": 100, "1": 55 },
  },
  {
    date: "2023-06-01",
    totalUsers: 2400,
    retention: { "0": 100 },
  },
];

const MOCK_JOURNEY_STEPS = [
  {
    id: "1",
    type: "user_signup",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    details: { method: "email", source: "referral" },
    status: "success",
  },
  {
    id: "2",
    type: "email_verification_sent",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5 + 1000 * 60),
    details: { template: "welcome_email" },
    channel: "EMAIL",
    status: "delivered",
  },
  {
    id: "3",
    type: "email_opened",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5 + 1000 * 60 * 15),
    details: { device: "mobile" },
    channel: "EMAIL",
    status: "success",
  },
  {
    id: "4",
    type: "login",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
    details: { ip: "192.168.1.1" },
    status: "success",
  },
  {
    id: "5",
    type: "campaign_notification_sent",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    details: { campaign: "Summer Sale" },
    channel: "SMS",
    status: "failed",
  },
  {
    id: "6",
    type: "campaign_notification_retry",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2 + 1000 * 60 * 5),
    details: { campaign: "Summer Sale", attempt: 2 },
    channel: "SMS",
    status: "delivered",
  },
];

export function AdvancedDashboard() {
  const [activeTab, setActiveTab] = useState("performance");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advanced Analytics</h2>
          <p className="text-muted-foreground">
            Deep dive into your data with advanced metrics and visualizations.
          </p>
        </div>
      </div>

      <Tabs defaultValue="performance" className="space-y-6" onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="performance" className="gap-2">
            <ChartBarIcon className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="retention" className="gap-2">
            <ChartBarIcon className="h-4 w-4" />
            Retention
          </TabsTrigger>
          <TabsTrigger value="journey" className="gap-2">
            <ChartPieIcon className="h-4 w-4" />
            User Journey
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="performance"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <PerformanceMonitor />
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-border/50 p-6">
              <h3 className="mb-4 text-lg font-semibold">Optimal Send Times</h3>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Heatmap visualization placeholder</p>
              </div>
            </Card>
            <Card className="glass border-border/50 p-6">
              <h3 className="mb-4 text-lg font-semibold">Revenue Attribution</h3>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Attribution chart placeholder</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="retention"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <CohortChart
            data={
              MOCK_COHORT_DATA as Array<{
                date: string;
                totalUsers: number;
                retention: Record<string, number>;
              }>
            }
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass border-border/50 p-6">
              <h3 className="mb-4 text-lg font-semibold">Churn Risk Analysis</h3>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Risk segments placeholder</p>
              </div>
            </Card>
            <Card className="glass border-border/50 p-6">
              <h3 className="mb-4 text-lg font-semibold">Segment Performance</h3>
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
                <p className="text-muted-foreground">Segment comparison placeholder</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="journey"
          className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card className="glass border-border/50 p-6">
                <h3 className="mb-4 text-lg font-semibold">Select User</h3>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Search by email or ID..."
                    className="bg-background border-input w-full rounded-md border px-3 py-2 text-sm"
                  />
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="hover:bg-muted/50 cursor-pointer rounded-md p-3 transition-colors"
                      >
                        <p className="font-medium">user_{i}@example.com</p>
                        <p className="text-muted-foreground text-xs">Last seen 2h ago</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <UserJourneyMap steps={MOCK_JOURNEY_STEPS} userIdentifier="user_1@example.com" />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
