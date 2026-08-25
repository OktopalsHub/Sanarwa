import { createFileRoute } from "@tanstack/react-router";
import { TenantRouteRedirect } from "@/components/layout/tenant-route-redirect";

export const Route = createFileRoute("/analytics")({
  component: () => <TenantRouteRedirect suffix="analytics" />,
});
