import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminTrustEngine = lazy(() => import("@/pages/AdminTrustEngine"));

export const Route = createFileRoute("/admin/trust-engine")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/trust-engine" },
      { name: "description", content: "ANGEL AI — admin/trust-engine" },
      { property: "og:title", content: "ANGEL AI — admin/trust-engine" },
      { property: "og:description", content: "ANGEL AI — admin/trust-engine" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminTrustEngine />;
}
