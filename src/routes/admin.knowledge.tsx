import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminKnowledge = lazy(() => import("@/pages/AdminKnowledge"));

export const Route = createFileRoute("/admin/knowledge")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/knowledge" },
      { name: "description", content: "ANGEL AI — admin/knowledge" },
      { property: "og:title", content: "ANGEL AI — admin/knowledge" },
      { property: "og:description", content: "ANGEL AI — admin/knowledge" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminKnowledge />;
}
