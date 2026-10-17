import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";
const CtoCloudCost = lazy(() => import("@/pages/cto/CloudCost"));

export const Route = createFileRoute("/cto/cloud-cost")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/cloud-cost" },
      { name: "description", content: "ANGEL AI — cto/cloud-cost" },
      { property: "og:title", content: "ANGEL AI — cto/cloud-cost" },
      { property: "og:description", content: "ANGEL AI — cto/cloud-cost" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoCloudCost /></RequireCoreAccess>;
}
