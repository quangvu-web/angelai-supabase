import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/quest")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — quest" },
      { name: "description", content: "ANGEL AI — quest" },
      { property: "og:title", content: "ANGEL AI — quest" },
      { property: "og:description", content: "ANGEL AI — quest" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/quest" featureName="Daily Light Quest" />;
}
