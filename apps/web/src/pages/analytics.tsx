'use client';

import { AnalyticsDashboard } from '@/components/analytics';
import { AppShell } from '@/components/layout';

function AnalyticsContent() {
  return (
    <AppShell>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* <PermissionGate permissions={['analytics:read']}> */}
          <AnalyticsDashboard />
          {/* </PermissionGate> */}
        </div>
      </div>
    </AppShell>
  );
}

export default function AnalyticsPage() {
  return (
    /* <ProtectedRoute> */
    <AnalyticsContent />
    /* </ProtectedRoute> */
  );
}