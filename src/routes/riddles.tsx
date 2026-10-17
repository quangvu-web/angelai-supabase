import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/riddles")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — riddles" },
      { name: "description", content: "ANGEL AI — riddles" },
      { property: "og:title", content: "ANGEL AI — riddles" },
      { property: "og:description", content: "ANGEL AI — riddles" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/riddles" featureName="Cosmic Riddles" />;
}
