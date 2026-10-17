import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminReport = lazy(() => import("@/pages/AdminReport"));

export const Route = createFileRoute("/admin/report")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/report" },
      { name: "description", content: "ANGEL AI — admin/report" },
      { property: "og:title", content: "ANGEL AI — admin/report" },
      { property: "og:description", content: "ANGEL AI — admin/report" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminReport />;
}
