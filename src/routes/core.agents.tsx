import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoreAgents = lazy(() => import("@/pages/core/Agents"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core/agents")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core/agents" },
      { name: "description", content: "ANGEL AI — core/agents" },
      { property: "og:title", content: "ANGEL AI — core/agents" },
      { property: "og:description", content: "ANGEL AI — core/agents" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CoreAgents /></RequireCoreAccess>;
}
