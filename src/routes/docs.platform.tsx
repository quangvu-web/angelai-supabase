import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const PlatformDocs = lazy(() => import("@/pages/docs/Platform"));

export const Route = createFileRoute("/docs/platform")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/platform" },
      { name: "description", content: "ANGEL AI — docs/platform" },
      { property: "og:title", content: "ANGEL AI — docs/platform" },
      { property: "og:description", content: "ANGEL AI — docs/platform" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <PlatformDocs />;
}
