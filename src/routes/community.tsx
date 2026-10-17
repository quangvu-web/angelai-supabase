import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — community" },
      { name: "description", content: "ANGEL AI — community" },
      { property: "og:title", content: "ANGEL AI — community" },
      { property: "og:description", content: "ANGEL AI — community" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/community" featureName="Cộng đồng" />;
}
