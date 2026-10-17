import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/raid")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — raid" },
      { name: "description", content: "ANGEL AI — raid" },
      { property: "og:title", content: "ANGEL AI — raid" },
      { property: "og:description", content: "ANGEL AI — raid" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/raid" featureName="Boss Raid" />;
}
