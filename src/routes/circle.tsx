import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/circle")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — circle" },
      { name: "description", content: "ANGEL AI — circle" },
      { property: "og:title", content: "ANGEL AI — circle" },
      { property: "og:description", content: "ANGEL AI — circle" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/circle" featureName="Light Circle" />;
}
