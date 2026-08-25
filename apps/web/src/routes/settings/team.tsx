import { createFileRoute } from "@tanstack/react-router";
import TeamManagementPage from "@/pages/settings-team";

export const Route = createFileRoute("/settings/team")({
  component: TeamManagementPage,
});
