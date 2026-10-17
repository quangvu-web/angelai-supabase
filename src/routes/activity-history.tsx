import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const ActivityHistory = lazy(() => import("@/pages/ActivityHistory"));

export const Route = createFileRoute("/activity-history")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — activity-history" },
      { name: "description", content: "ANGEL AI — activity-history" },
      { property: "og:title", content: "ANGEL AI — activity-history" },
      { property: "og:description", content: "ANGEL AI — activity-history" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ActivityHistory />;
}
