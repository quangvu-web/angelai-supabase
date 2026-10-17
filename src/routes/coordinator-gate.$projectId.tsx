import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoordinatorProject = lazy(() => import("@/pages/CoordinatorProject"));

export const Route = createFileRoute("/coordinator-gate/$projectId")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — coordinator-gate/:projectId" },
      { name: "description", content: "ANGEL AI — coordinator-gate/:projectId" },
      { property: "og:title", content: "ANGEL AI — coordinator-gate/:projectId" },
      { property: "og:description", content: "ANGEL AI — coordinator-gate/:projectId" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <CoordinatorProject />;
}
