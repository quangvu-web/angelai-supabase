import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Bounty = lazy(() => import("@/pages/Bounty"));

export const Route = createFileRoute("/bounty")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — bounty" },
      { name: "description", content: "ANGEL AI — bounty" },
      { property: "og:title", content: "ANGEL AI — bounty" },
      { property: "og:description", content: "ANGEL AI — bounty" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Bounty />;
}
