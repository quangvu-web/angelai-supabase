import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoreLogs = lazy(() => import("@/pages/core/Logs"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core/logs")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core/logs" },
      { name: "description", content: "ANGEL AI — core/logs" },
      { property: "og:title", content: "ANGEL AI — core/logs" },
      { property: "og:description", content: "ANGEL AI — core/logs" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CoreLogs /></RequireCoreAccess>;
}
