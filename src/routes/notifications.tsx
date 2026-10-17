import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Notifications = lazy(() => import("@/pages/Notifications"));

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — notifications" },
      { name: "description", content: "ANGEL AI — notifications" },
      { property: "og:title", content: "ANGEL AI — notifications" },
      { property: "og:description", content: "ANGEL AI — notifications" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Notifications />;
}
