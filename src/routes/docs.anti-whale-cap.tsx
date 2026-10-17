import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AntiWhaleCap = lazy(() => import("@/pages/docs/AntiWhaleCap"));

export const Route = createFileRoute("/docs/anti-whale-cap")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/anti-whale-cap" },
      { name: "description", content: "ANGEL AI — docs/anti-whale-cap" },
      { property: "og:title", content: "ANGEL AI — docs/anti-whale-cap" },
      { property: "og:description", content: "ANGEL AI — docs/anti-whale-cap" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AntiWhaleCap />;
}
