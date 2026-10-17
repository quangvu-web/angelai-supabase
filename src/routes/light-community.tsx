import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/light-community")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — light-community" },
      { name: "description", content: "ANGEL AI — light-community" },
      { property: "og:title", content: "ANGEL AI — light-community" },
      { property: "og:description", content: "ANGEL AI — light-community" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/community" featureName="Light Community" />;
}
