import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/forge")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — forge" },
      { name: "description", content: "ANGEL AI — forge" },
      { property: "og:title", content: "ANGEL AI — forge" },
      { property: "og:description", content: "ANGEL AI — forge" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/forge" featureName="Light Forge" />;
}
