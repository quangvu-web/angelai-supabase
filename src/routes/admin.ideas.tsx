import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminIdeas = lazy(() => import("@/pages/AdminIdeas"));

export const Route = createFileRoute("/admin/ideas")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/ideas" },
      { name: "description", content: "ANGEL AI — admin/ideas" },
      { property: "og:title", content: "ANGEL AI — admin/ideas" },
      { property: "og:description", content: "ANGEL AI — admin/ideas" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminIdeas />;
}
