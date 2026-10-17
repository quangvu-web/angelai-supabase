import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/community-questions")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — community-questions" },
      { name: "description", content: "ANGEL AI — community-questions" },
      { property: "og:title", content: "ANGEL AI — community-questions" },
      { property: "og:description", content: "ANGEL AI — community-questions" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich/questions" featureName="Cộng đồng hỏi đáp" />;
}
