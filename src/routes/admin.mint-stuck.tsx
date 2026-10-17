import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const MintStuckPanel = lazy(() => import("@/pages/admin/MintStuckPanel"));

export const Route = createFileRoute("/admin/mint-stuck")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/mint-stuck" },
      { name: "description", content: "ANGEL AI — admin/mint-stuck" },
      { property: "og:title", content: "ANGEL AI — admin/mint-stuck" },
      { property: "og:description", content: "ANGEL AI — admin/mint-stuck" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MintStuckPanel />;
}
