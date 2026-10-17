import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminEarlyAdopters = lazy(() => import("@/pages/AdminEarlyAdopters"));

export const Route = createFileRoute("/admin/early-adopters")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/early-adopters" },
      { name: "description", content: "ANGEL AI — admin/early-adopters" },
      { property: "og:title", content: "ANGEL AI — admin/early-adopters" },
      { property: "og:description", content: "ANGEL AI — admin/early-adopters" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminEarlyAdopters />;
}
