import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/messages/$userId")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — messages/:userId" },
      { name: "description", content: "ANGEL AI — messages/:userId" },
      { property: "og:title", content: "ANGEL AI — messages/:userId" },
      { property: "og:description", content: "ANGEL AI — messages/:userId" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/messages" featureName="Tin nhắn" />;
}
