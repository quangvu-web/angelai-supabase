import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";
const CtoHealth = lazy(() => import("@/pages/cto/SystemHealth"));

export const Route = createFileRoute("/cto/health")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/health" },
      { name: "description", content: "ANGEL AI — cto/health" },
      { property: "og:title", content: "ANGEL AI — cto/health" },
      { property: "og:description", content: "ANGEL AI — cto/health" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoHealth /></RequireCoreAccess>;
}
