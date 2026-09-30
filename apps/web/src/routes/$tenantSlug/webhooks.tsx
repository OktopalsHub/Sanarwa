import { createFileRoute } from '@tanstack/react-router';
import WebhooksPage from '@/pages/tenantSlug-webhooks';

export const Route = createFileRoute('/$tenantSlug/webhooks')({
  component: WebhooksPage,
});
