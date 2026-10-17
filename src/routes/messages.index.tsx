import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/messages//")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — messages" },
      { name: "description", content: "ANGEL AI — messages" },
      { property: "og:title", content: "ANGEL AI — messages" },
      { property: "og:description", content: "ANGEL AI — messages" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/messages" featureName="Tin nhắn" />;
}
