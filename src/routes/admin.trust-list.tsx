import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminTrustList = lazy(() => import("@/pages/AdminTrustList"));

export const Route = createFileRoute("/admin/trust-list")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/trust-list" },
      { name: "description", content: "ANGEL AI — admin/trust-list" },
      { property: "og:title", content: "ANGEL AI — admin/trust-list" },
      { property: "og:description", content: "ANGEL AI — admin/trust-list" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminTrustList />;
}
