import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminActivityHistory = lazy(() => import("@/pages/AdminActivityHistory"));

export const Route = createFileRoute("/admin/activity-history")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/activity-history" },
      { name: "description", content: "ANGEL AI — admin/activity-history" },
      { property: "og:title", content: "ANGEL AI — admin/activity-history" },
      { property: "og:description", content: "ANGEL AI — admin/activity-history" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminActivityHistory />;
}
