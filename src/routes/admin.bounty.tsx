import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminBounty = lazy(() => import("@/pages/AdminBounty"));

export const Route = createFileRoute("/admin/bounty")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/bounty" },
      { name: "description", content: "ANGEL AI — admin/bounty" },
      { property: "og:title", content: "ANGEL AI — admin/bounty" },
      { property: "og:description", content: "ANGEL AI — admin/bounty" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminBounty />;
}
