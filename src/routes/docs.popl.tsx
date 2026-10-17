import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const PoPLWhitepaper = lazy(() => import("@/pages/docs/PoPLWhitepaper"));

export const Route = createFileRoute("/docs/popl")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/popl" },
      { name: "description", content: "ANGEL AI — docs/popl" },
      { property: "og:title", content: "ANGEL AI — docs/popl" },
      { property: "og:description", content: "ANGEL AI — docs/popl" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <PoPLWhitepaper />;
}
