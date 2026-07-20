import { createFileRoute } from '@tanstack/react-router';
import ProjectDetailPage from '@/pages/tenantSlug-projects-projectId';

export const Route = createFileRoute('/$tenantSlug/projects/$projectId')({
  component: ProjectDetailPage,
});
