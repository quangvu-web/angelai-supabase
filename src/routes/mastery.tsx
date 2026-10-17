import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/mastery")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — mastery" },
      { name: "description", content: "ANGEL AI — mastery" },
      { property: "og:title", content: "ANGEL AI — mastery" },
      { property: "og:description", content: "ANGEL AI — mastery" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/mastery" featureName="Light Mastery" />;
}
