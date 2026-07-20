import { createFileRoute } from '@tanstack/react-router';
import ThemeDemoPage from '@/pages/theme-demo';

export const Route = createFileRoute('/theme-demo')({
  component: ThemeDemoPage,
});
