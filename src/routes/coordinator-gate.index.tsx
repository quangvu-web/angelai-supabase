import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoordinatorGate = lazy(() => import("@/pages/CoordinatorGate"));

export const Route = createFileRoute("/coordinator-gate//")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — coordinator-gate" },
      { name: "description", content: "ANGEL AI — coordinator-gate" },
      { property: "og:title", content: "ANGEL AI — coordinator-gate" },
      { property: "og:description", content: "ANGEL AI — coordinator-gate" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <CoordinatorGate />;
}
