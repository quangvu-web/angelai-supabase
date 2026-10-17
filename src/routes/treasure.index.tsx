import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/treasure/")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — treasure" },
      { name: "description", content: "ANGEL AI — treasure" },
      { property: "og:title", content: "ANGEL AI — treasure" },
      { property: "og:description", content: "ANGEL AI — treasure" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/treasure" featureName="Treasure Hunt" />;
}
