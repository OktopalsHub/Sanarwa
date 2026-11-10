import { createFileRoute } from "@tanstack/react-router";
import ChannelsPage from "@/pages/tenantSlug-channels";

export const Route = createFileRoute("/$tenantSlug/channels")({
  component: ChannelsPage,
});
