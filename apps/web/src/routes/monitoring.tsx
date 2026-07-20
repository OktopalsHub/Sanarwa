import { createFileRoute } from '@tanstack/react-router';
import MonitoringPage from '@/pages/monitoring';

export const Route = createFileRoute('/monitoring')({
  component: MonitoringPage,
});
