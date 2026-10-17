import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CtoSecurity = lazy(() => import("@/pages/cto/Security"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/cto/security")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/security" },
      { name: "description", content: "ANGEL AI — cto/security" },
      { property: "og:title", content: "ANGEL AI — cto/security" },
      { property: "og:description", content: "ANGEL AI — cto/security" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoSecurity /></RequireCoreAccess>;
}
