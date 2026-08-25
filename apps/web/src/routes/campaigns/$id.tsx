import { createFileRoute } from "@tanstack/react-router";
import { TenantRouteRedirect } from "@/components/layout/tenant-route-redirect";
import { useParams } from "@tanstack/react-router";

function CampaignDetailRedirect() {
  const { id } = useParams({ strict: false }) as { id?: string };
  return <TenantRouteRedirect suffix={`campaigns/${id ?? ""}`} />;
}

export const Route = createFileRoute("/campaigns/$id")({
  component: CampaignDetailRedirect,
});
