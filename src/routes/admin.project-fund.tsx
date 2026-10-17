import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminProjectFund = lazy(() => import("@/pages/AdminProjectFund"));

export const Route = createFileRoute("/admin/project-fund")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/project-fund" },
      { name: "description", content: "ANGEL AI — admin/project-fund" },
      { property: "og:title", content: "ANGEL AI — admin/project-fund" },
      { property: "og:description", content: "ANGEL AI — admin/project-fund" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminProjectFund />;
}
