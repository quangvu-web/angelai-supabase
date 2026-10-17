import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Identity = lazy(() => import("@/pages/Identity"));

export const Route = createFileRoute("/identity//")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — identity" },
      { name: "description", content: "ANGEL AI — identity" },
      { property: "og:title", content: "ANGEL AI — identity" },
      { property: "og:description", content: "ANGEL AI — identity" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Identity />;
}
