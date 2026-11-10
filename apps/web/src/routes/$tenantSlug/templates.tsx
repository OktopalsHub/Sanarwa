import { createFileRoute } from "@tanstack/react-router";
import TemplatesPage from "@/pages/templates";

export const Route = createFileRoute("/$tenantSlug/templates")({
  component: TemplatesPage,
});
