import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminOnChainDashboard = lazy(() => import("@/pages/AdminOnChainDashboard"));

export const Route = createFileRoute("/admin/onchain")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/onchain" },
      { name: "description", content: "ANGEL AI — admin/onchain" },
      { property: "og:title", content: "ANGEL AI — admin/onchain" },
      { property: "og:description", content: "ANGEL AI — admin/onchain" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminOnChainDashboard />;
}
