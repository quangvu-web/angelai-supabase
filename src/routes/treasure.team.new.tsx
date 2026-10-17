import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/treasure/team/new")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — treasure/team/new" },
      { name: "description", content: "ANGEL AI — treasure/team/new" },
      { property: "og:title", content: "ANGEL AI — treasure/team/new" },
      { property: "og:description", content: "ANGEL AI — treasure/team/new" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/treasure" featureName="Treasure Team" />;
}
