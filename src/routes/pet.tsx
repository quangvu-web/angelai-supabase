import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/pet")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — pet" },
      { name: "description", content: "ANGEL AI — pet" },
      { property: "og:title", content: "ANGEL AI — pet" },
      { property: "og:description", content: "ANGEL AI — pet" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/pet" featureName="AI Companion Pet" />;
}
