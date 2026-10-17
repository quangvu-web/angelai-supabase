import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/$username/post/$slug")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — :username/post/:slug" },
      { name: "description", content: "ANGEL AI — :username/post/:slug" },
      { property: "og:title", content: "ANGEL AI — :username/post/:slug" },
      { property: "og:description", content: "ANGEL AI — :username/post/:slug" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich" featureName="Bài viết" />;
}
