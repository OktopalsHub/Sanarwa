import { createFileRoute } from '@tanstack/react-router';
import PlaygroundPage from '@/pages/docs-playground';

export const Route = createFileRoute('/docs/playground')({
  component: PlaygroundPage,
});
