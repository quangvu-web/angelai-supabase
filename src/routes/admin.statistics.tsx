import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminStatistics = lazy(() => import("@/pages/AdminStatistics"));

export const Route = createFileRoute("/admin/statistics")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/statistics" },
      { name: "description", content: "ANGEL AI — admin/statistics" },
      { property: "og:title", content: "ANGEL AI — admin/statistics" },
      { property: "og:description", content: "ANGEL AI — admin/statistics" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminStatistics />;
}
