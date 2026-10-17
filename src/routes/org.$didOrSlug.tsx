import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const OrgProfile = lazy(() => import("@/pages/OrgProfile"));

export const Route = createFileRoute("/org/$didOrSlug")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — org/:didOrSlug" },
      { name: "description", content: "ANGEL AI — org/:didOrSlug" },
      { property: "og:title", content: "ANGEL AI — org/:didOrSlug" },
      { property: "og:description", content: "ANGEL AI — org/:didOrSlug" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <OrgProfile />;
}
