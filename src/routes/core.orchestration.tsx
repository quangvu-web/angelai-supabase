import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoreOrchestration = lazy(() => import("@/pages/core/Orchestration"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core/orchestration")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core/orchestration" },
      { name: "description", content: "ANGEL AI — core/orchestration" },
      { property: "og:title", content: "ANGEL AI — core/orchestration" },
      { property: "og:description", content: "ANGEL AI — core/orchestration" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CoreOrchestration /></RequireCoreAccess>;
}
