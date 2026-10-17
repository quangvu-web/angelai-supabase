import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CtoApiDocs = lazy(() => import("@/pages/cto/FunCoreApi"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/cto/api-docs")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/api-docs" },
      { name: "description", content: "ANGEL AI — cto/api-docs" },
      { property: "og:title", content: "ANGEL AI — cto/api-docs" },
      { property: "og:description", content: "ANGEL AI — cto/api-docs" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoApiDocs /></RequireCoreAccess>;
}
