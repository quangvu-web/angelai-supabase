import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/season")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — season" },
      { name: "description", content: "ANGEL AI — season" },
      { property: "og:title", content: "ANGEL AI — season" },
      { property: "og:description", content: "ANGEL AI — season" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/season" featureName="Season Pass" />;
}
