import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Swap = lazy(() => import("@/pages/Swap"));

export const Route = createFileRoute("/swap")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — swap" },
      { name: "description", content: "ANGEL AI — swap" },
      { property: "og:title", content: "ANGEL AI — swap" },
      { property: "og:description", content: "ANGEL AI — swap" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Swap />;
}
