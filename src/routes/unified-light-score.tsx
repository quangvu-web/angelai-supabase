import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const UnifiedLightScore = lazy(() => import("@/pages/UnifiedLightScore"));

export const Route = createFileRoute("/unified-light-score")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — unified-light-score" },
      { name: "description", content: "ANGEL AI — unified-light-score" },
      { property: "og:title", content: "ANGEL AI — unified-light-score" },
      { property: "og:description", content: "ANGEL AI — unified-light-score" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <UnifiedLightScore />;
}
