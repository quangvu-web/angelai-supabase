import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminAIUsage = lazy(() => import("@/pages/AdminAIUsage"));

export const Route = createFileRoute("/admin/ai-usage")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/ai-usage" },
      { name: "description", content: "ANGEL AI — admin/ai-usage" },
      { property: "og:title", content: "ANGEL AI — admin/ai-usage" },
      { property: "og:description", content: "ANGEL AI — admin/ai-usage" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminAIUsage />;
}
