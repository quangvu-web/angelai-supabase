import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Gratitude = lazy(() => import("@/pages/Gratitude"));

export const Route = createFileRoute("/gratitude")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — gratitude" },
      { name: "description", content: "ANGEL AI — gratitude" },
      { property: "og:title", content: "ANGEL AI — gratitude" },
      { property: "og:description", content: "ANGEL AI — gratitude" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Gratitude />;
}
