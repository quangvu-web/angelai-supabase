import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminThresholds = lazy(() => import("@/pages/AdminThresholds"));

export const Route = createFileRoute("/admin/thresholds")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/thresholds" },
      { name: "description", content: "ANGEL AI — admin/thresholds" },
      { property: "og:title", content: "ANGEL AI — admin/thresholds" },
      { property: "og:description", content: "ANGEL AI — admin/thresholds" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminThresholds />;
}
