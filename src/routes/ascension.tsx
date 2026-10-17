import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/ascension")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — ascension" },
      { name: "description", content: "ANGEL AI — ascension" },
      { property: "og:title", content: "ANGEL AI — ascension" },
      { property: "og:description", content: "ANGEL AI — ascension" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/ascension" featureName="Light Ascension" />;
}
