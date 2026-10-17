import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AICoreDashboard = lazy(() => import("@/pages/core/AICoreDashboard"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core" },
      { name: "description", content: "ANGEL AI — core" },
      { property: "og:title", content: "ANGEL AI — core" },
      { property: "og:description", content: "ANGEL AI — core" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><AICoreDashboard /></RequireCoreAccess>;
}
