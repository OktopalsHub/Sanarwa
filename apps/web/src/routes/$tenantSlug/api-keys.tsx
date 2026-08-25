import { createFileRoute } from "@tanstack/react-router";
import ApiKeysPage from "@/pages/tenantSlug-api-keys";

export const Route = createFileRoute("/$tenantSlug/api-keys")({
  component: ApiKeysPage,
});
