import { createFileRoute } from '@tanstack/react-router';
import ExamplesPage from '@/pages/docs-examples';

export const Route = createFileRoute('/docs/examples')({
  component: ExamplesPage,
});
