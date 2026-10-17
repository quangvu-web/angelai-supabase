import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/dashboard" },
      { name: "description", content: "ANGEL AI — admin/dashboard" },
      { property: "og:title", content: "ANGEL AI — admin/dashboard" },
      { property: "og:description", content: "ANGEL AI — admin/dashboard" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminDashboard />;
}
