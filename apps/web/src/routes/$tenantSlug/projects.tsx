import { createFileRoute } from "@tanstack/react-router";
import ProjectsPage from "@/pages/tenantSlug-projects";

export const Route = createFileRoute("/$tenantSlug/projects")({
  component: ProjectsPage,
});
