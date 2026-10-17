import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminFraudAlerts = lazy(() => import("@/pages/AdminFraudAlerts"));

export const Route = createFileRoute("/admin/fraud-alerts")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/fraud-alerts" },
      { name: "description", content: "ANGEL AI — admin/fraud-alerts" },
      { property: "og:title", content: "ANGEL AI — admin/fraud-alerts" },
      { property: "og:description", content: "ANGEL AI — admin/fraud-alerts" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminFraudAlerts />;
}
