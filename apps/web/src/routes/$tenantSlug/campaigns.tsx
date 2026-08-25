import { createFileRoute } from "@tanstack/react-router";
import CampaignsPage from "@/pages/campaigns";

export const Route = createFileRoute("/$tenantSlug/campaigns")({
  component: CampaignsPage,
});
