import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminTetReward = lazy(() => import("@/pages/AdminTetReward"));

export const Route = createFileRoute("/admin/tet-reward")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/tet-reward" },
      { name: "description", content: "ANGEL AI — admin/tet-reward" },
      { property: "og:title", content: "ANGEL AI — admin/tet-reward" },
      { property: "og:description", content: "ANGEL AI — admin/tet-reward" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminTetReward />;
}
