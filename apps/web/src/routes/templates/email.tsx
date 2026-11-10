import { createFileRoute } from "@tanstack/react-router";
import EmailTemplatePage from "@/pages/templates-email";

export const Route = createFileRoute("/templates/email")({
  component: EmailTemplatePage,
});
