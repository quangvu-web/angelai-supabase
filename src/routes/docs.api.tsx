import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const ApiReference = lazy(() => import("@/pages/docs/ApiReference"));

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/api" },
      { name: "description", content: "ANGEL AI — docs/api" },
      { property: "og:title", content: "ANGEL AI — docs/api" },
      { property: "og:description", content: "ANGEL AI — docs/api" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ApiReference />;
}
