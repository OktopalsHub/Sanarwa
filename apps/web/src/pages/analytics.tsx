"use client";

import { AnalyticsDashboard } from "@/components/analytics";
import { AppShell } from "@/components/layout";

function AnalyticsContent() {
  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <AnalyticsDashboard />
        </div>
      </div>
    </AppShell>
  );
}

export default function AnalyticsPage() {
  return <AnalyticsContent />;
}
