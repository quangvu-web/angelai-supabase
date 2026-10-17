import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — games" },
      { name: "description", content: "ANGEL AI — games" },
      { property: "og:title", content: "ANGEL AI — games" },
      { property: "og:description", content: "ANGEL AI — games" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/games" featureName="Mini Games" />;
}
