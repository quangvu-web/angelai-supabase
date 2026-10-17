import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CtoPlatforms = lazy(() => import("@/pages/cto/PlatformConnections"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/cto/platforms")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/platforms" },
      { name: "description", content: "ANGEL AI — cto/platforms" },
      { property: "og:title", content: "ANGEL AI — cto/platforms" },
      { property: "og:description", content: "ANGEL AI — cto/platforms" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoPlatforms /></RequireCoreAccess>;
}
