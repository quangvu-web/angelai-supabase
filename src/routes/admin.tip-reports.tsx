import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminTipReports = lazy(() => import("@/pages/AdminTipReports"));

export const Route = createFileRoute("/admin/tip-reports")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/tip-reports" },
      { name: "description", content: "ANGEL AI — admin/tip-reports" },
      { property: "og:title", content: "ANGEL AI — admin/tip-reports" },
      { property: "og:description", content: "ANGEL AI — admin/tip-reports" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminTipReports />;
}
