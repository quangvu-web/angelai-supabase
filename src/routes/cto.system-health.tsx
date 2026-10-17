import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";
const CtoHealth = lazy(() => import("@/pages/cto/SystemHealth"));

export const Route = createFileRoute("/cto/system-health")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/system-health" },
      { name: "description", content: "ANGEL AI — cto/system-health" },
      { property: "og:title", content: "ANGEL AI — cto/system-health" },
      { property: "og:description", content: "ANGEL AI — cto/system-health" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoHealth /></RequireCoreAccess>;
}
