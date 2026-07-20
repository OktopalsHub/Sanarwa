import { createFileRoute } from '@tanstack/react-router';
import SDKsPage from '@/pages/docs-sdks';

export const Route = createFileRoute('/docs/sdks')({
  component: SDKsPage,
});
