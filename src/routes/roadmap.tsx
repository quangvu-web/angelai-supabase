import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Roadmap = lazy(() => import("@/pages/Roadmap"));

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — roadmap" },
      { name: "description", content: "ANGEL AI — roadmap" },
      { property: "og:title", content: "ANGEL AI — roadmap" },
      { property: "og:description", content: "ANGEL AI — roadmap" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Roadmap />;
}
