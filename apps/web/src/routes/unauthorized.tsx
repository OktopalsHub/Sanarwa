import { createFileRoute } from "@tanstack/react-router";
import UnauthorizedPage from "@/pages/unauthorized";

export const Route = createFileRoute("/unauthorized")({
  component: UnauthorizedPage,
});
