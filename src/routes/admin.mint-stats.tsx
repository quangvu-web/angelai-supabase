import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminMintStats = lazy(() => import("@/pages/AdminMintStats"));

export const Route = createFileRoute("/admin/mint-stats")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/mint-stats" },
      { name: "description", content: "ANGEL AI — admin/mint-stats" },
      { property: "og:title", content: "ANGEL AI — admin/mint-stats" },
      { property: "og:description", content: "ANGEL AI — admin/mint-stats" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminMintStats />;
}
