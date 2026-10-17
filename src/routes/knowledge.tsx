import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Knowledge = lazy(() => import("@/pages/Knowledge"));

export const Route = createFileRoute("/knowledge")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — knowledge" },
      { name: "description", content: "ANGEL AI — knowledge" },
      { property: "og:title", content: "ANGEL AI — knowledge" },
      { property: "og:description", content: "ANGEL AI — knowledge" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Knowledge />;
}
