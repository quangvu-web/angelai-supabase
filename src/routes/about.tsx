import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const About = lazy(() => import("@/pages/About"));

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — about" },
      { name: "description", content: "ANGEL AI — about" },
      { property: "og:title", content: "ANGEL AI — about" },
      { property: "og:description", content: "ANGEL AI — about" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <About />;
}
