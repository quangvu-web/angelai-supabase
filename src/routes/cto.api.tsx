import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CtoApi = lazy(() => import("@/pages/cto/ApiManagement"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/cto/api")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/api" },
      { name: "description", content: "ANGEL AI — cto/api" },
      { property: "og:title", content: "ANGEL AI — cto/api" },
      { property: "og:description", content: "ANGEL AI — cto/api" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoApi /></RequireCoreAccess>;
}
