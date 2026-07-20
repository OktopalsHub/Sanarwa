import { createFileRoute } from '@tanstack/react-router';
import DashboardDemo from '@/pages/dashboard-demo';

export const Route = createFileRoute('/dashboard-demo')({
  component: DashboardDemo,
});
