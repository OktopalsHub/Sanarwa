import { createFileRoute } from '@tanstack/react-router';
import TroubleshootingPage from '@/pages/docs-troubleshooting';

export const Route = createFileRoute('/docs/troubleshooting')({
  component: TroubleshootingPage,
});
