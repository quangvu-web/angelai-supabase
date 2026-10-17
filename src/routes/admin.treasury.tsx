import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminTreasury = lazy(() => import("@/pages/AdminTreasury"));

export const Route = createFileRoute("/admin/treasury")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/treasury" },
      { name: "description", content: "ANGEL AI — admin/treasury" },
      { property: "og:title", content: "ANGEL AI — admin/treasury" },
      { property: "og:description", content: "ANGEL AI — admin/treasury" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminTreasury />;
}
