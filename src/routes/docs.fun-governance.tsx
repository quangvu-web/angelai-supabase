import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const FunGovernance = lazy(() => import("@/pages/docs/FunGovernance"));

export const Route = createFileRoute("/docs/fun-governance")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/fun-governance" },
      { name: "description", content: "ANGEL AI — docs/fun-governance" },
      { property: "og:title", content: "ANGEL AI — docs/fun-governance" },
      { property: "og:description", content: "ANGEL AI — docs/fun-governance" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <FunGovernance />;
}
