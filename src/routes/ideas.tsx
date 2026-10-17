import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Ideas = lazy(() => import("@/pages/Ideas"));

export const Route = createFileRoute("/ideas")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — ideas" },
      { name: "description", content: "ANGEL AI — ideas" },
      { property: "og:title", content: "ANGEL AI — ideas" },
      { property: "og:description", content: "ANGEL AI — ideas" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Ideas />;
}
