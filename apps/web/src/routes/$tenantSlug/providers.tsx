import { createFileRoute } from "@tanstack/react-router";
import ProvidersPage from "@/pages/tenantSlug-providers";

export const Route = createFileRoute("/$tenantSlug/providers")({
  component: ProvidersPage,
});
