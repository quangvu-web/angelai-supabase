import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/post/$postId")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — post/:postId" },
      { name: "description", content: "ANGEL AI — post/:postId" },
      { property: "og:title", content: "ANGEL AI — post/:postId" },
      { property: "og:description", content: "ANGEL AI — post/:postId" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich" featureName="Bài viết" />;
}
