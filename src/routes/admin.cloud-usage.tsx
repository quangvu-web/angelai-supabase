import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CloudUsageDashboard = lazy(() => import("@/pages/admin/CloudUsageDashboard"));

export const Route = createFileRoute("/admin/cloud-usage")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/cloud-usage" },
      { name: "description", content: "ANGEL AI — admin/cloud-usage" },
      { property: "og:title", content: "ANGEL AI — admin/cloud-usage" },
      { property: "og:description", content: "ANGEL AI — admin/cloud-usage" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <CloudUsageDashboard />;
}
