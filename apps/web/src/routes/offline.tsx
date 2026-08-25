import { createFileRoute } from "@tanstack/react-router";
import OfflinePage from "@/pages/offline";

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
});
