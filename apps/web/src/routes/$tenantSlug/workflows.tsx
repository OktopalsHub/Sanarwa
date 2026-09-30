import { createFileRoute } from "@tanstack/react-router";
import WorkflowsPage from "@/pages/workflows";

export const Route = createFileRoute("/$tenantSlug/workflows")({
  component: WorkflowsPage,
});
