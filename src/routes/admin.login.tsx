import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminLogin = lazy(() => import("@/pages/AdminLogin"));

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/login" },
      { name: "description", content: "ANGEL AI — admin/login" },
      { property: "og:title", content: "ANGEL AI — admin/login" },
      { property: "og:description", content: "ANGEL AI — admin/login" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminLogin />;
}
