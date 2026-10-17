import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/lantern")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — lantern" },
      { name: "description", content: "ANGEL AI — lantern" },
      { property: "og:title", content: "ANGEL AI — lantern" },
      { property: "og:description", content: "ANGEL AI — lantern" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/lantern" featureName="Lantern Path" />;
}
