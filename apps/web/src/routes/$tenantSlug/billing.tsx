import { createFileRoute } from "@tanstack/react-router";
import BillingPage from "@/pages/tenantSlug-billing";

export const Route = createFileRoute("/$tenantSlug/billing")({
  component: BillingPage,
});
