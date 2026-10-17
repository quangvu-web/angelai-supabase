import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const MasterCharter = lazy(() => import("@/pages/docs/MasterCharter"));

export const Route = createFileRoute("/docs/master-charter")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/master-charter" },
      { name: "description", content: "ANGEL AI — docs/master-charter" },
      { property: "og:title", content: "ANGEL AI — docs/master-charter" },
      { property: "og:description", content: "ANGEL AI — docs/master-charter" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <MasterCharter />;
}
