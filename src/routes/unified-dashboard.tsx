import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const UnifiedDashboard = lazy(() => import("@/pages/UnifiedDashboard"));

export const Route = createFileRoute("/unified-dashboard")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — unified-dashboard" },
      { name: "description", content: "ANGEL AI — unified-dashboard" },
      { property: "og:title", content: "ANGEL AI — unified-dashboard" },
      { property: "og:description", content: "ANGEL AI — unified-dashboard" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <UnifiedDashboard />;
}
