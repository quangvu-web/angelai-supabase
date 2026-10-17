import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CorePrompt = lazy(() => import("@/pages/docs/CorePrompt"));

export const Route = createFileRoute("/docs/core-prompt")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/core-prompt" },
      { name: "description", content: "ANGEL AI — docs/core-prompt" },
      { property: "og:title", content: "ANGEL AI — docs/core-prompt" },
      { property: "og:description", content: "ANGEL AI — docs/core-prompt" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <CorePrompt />;
}
