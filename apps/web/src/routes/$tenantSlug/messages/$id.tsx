import { createFileRoute } from "@tanstack/react-router";
import MessageDetailPage from "@/pages/tenantSlug-messages-id";

export const Route = createFileRoute("/$tenantSlug/messages/$id")({
  component: MessageDetailPage,
});
