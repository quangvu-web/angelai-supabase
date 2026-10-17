import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminUserManagement = lazy(() => import("@/pages/AdminUserManagement"));

export const Route = createFileRoute("/admin/user-management")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/user-management" },
      { name: "description", content: "ANGEL AI — admin/user-management" },
      { property: "og:title", content: "ANGEL AI — admin/user-management" },
      { property: "og:description", content: "ANGEL AI — admin/user-management" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminUserManagement />;
}
