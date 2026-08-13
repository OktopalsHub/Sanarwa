import { createFileRoute } from '@tanstack/react-router';
import MessagesPage from '@/pages/tenantSlug-messages';

export const Route = createFileRoute('/$tenantSlug/messages')({
  component: MessagesPage,
});
