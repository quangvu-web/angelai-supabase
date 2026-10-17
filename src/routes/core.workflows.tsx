import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoreWorkflows = lazy(() => import("@/pages/core/Workflows"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core/workflows")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core/workflows" },
      { name: "description", content: "ANGEL AI — core/workflows" },
      { property: "og:title", content: "ANGEL AI — core/workflows" },
      { property: "og:description", content: "ANGEL AI — core/workflows" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CoreWorkflows /></RequireCoreAccess>;
}
