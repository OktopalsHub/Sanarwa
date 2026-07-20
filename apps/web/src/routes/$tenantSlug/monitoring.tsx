import { createFileRoute } from '@tanstack/react-router';
import MonitoringPage from '@/pages/monitoring';

export const Route = createFileRoute('/$tenantSlug/monitoring')({
  component: MonitoringPage,
});
