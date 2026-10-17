import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminImageHistory = lazy(() => import("@/pages/AdminImageHistory"));

export const Route = createFileRoute("/admin/image-history")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/image-history" },
      { name: "description", content: "ANGEL AI — admin/image-history" },
      { property: "og:title", content: "ANGEL AI — admin/image-history" },
      { property: "og:description", content: "ANGEL AI — admin/image-history" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminImageHistory />;
}
