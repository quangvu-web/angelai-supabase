import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — achievements" },
      { name: "description", content: "ANGEL AI — achievements" },
      { property: "og:title", content: "ANGEL AI — achievements" },
      { property: "og:description", content: "ANGEL AI — achievements" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/achievements" featureName="Achievements" />;
}
