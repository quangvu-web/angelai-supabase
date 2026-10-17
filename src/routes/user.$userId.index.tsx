import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { MovedToFunRich } from "@/components/MovedToFunRich";

export const Route = createFileRoute("/user/$userId")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — user/:userId" },
      { name: "description", content: "ANGEL AI — user/:userId" },
      { property: "og:title", content: "ANGEL AI — user/:userId" },
      { property: "og:description", content: "ANGEL AI — user/:userId" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MovedToFunRich targetUrl="https://fun.rich" featureName="Hồ sơ người dùng" />;
}
