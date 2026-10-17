import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — inventory" },
      { name: "description", content: "ANGEL AI — inventory" },
      { property: "og:title", content: "ANGEL AI — inventory" },
      { property: "og:description", content: "ANGEL AI — inventory" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/inventory" featureName="Inventory" />;
}
