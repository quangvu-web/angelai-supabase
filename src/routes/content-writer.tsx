import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const ContentWriter = lazy(() => import("@/pages/ContentWriter"));

export const Route = createFileRoute("/content-writer")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — content-writer" },
      { name: "description", content: "ANGEL AI — content-writer" },
      { property: "og:title", content: "ANGEL AI — content-writer" },
      { property: "og:description", content: "ANGEL AI — content-writer" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ContentWriter />;
}
