import { MonitoringDashboard, RealTimeAlerts } from '@/components/monitoring';

export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MonitoringDashboard />
        </div>
        <div>
          <RealTimeAlerts maxAlerts={15} showNotifications={true} />
        </div>
      </div>
    </div>
  );
}