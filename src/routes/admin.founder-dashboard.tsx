import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const FounderDashboard = lazy(() => import("@/pages/FounderDashboard"));

export const Route = createFileRoute("/admin/founder-dashboard")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/founder-dashboard" },
      { name: "description", content: "ANGEL AI — admin/founder-dashboard" },
      { property: "og:title", content: "ANGEL AI — admin/founder-dashboard" },
      { property: "og:description", content: "ANGEL AI — admin/founder-dashboard" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <FounderDashboard />;
}
