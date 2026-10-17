import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Connector = lazy(() => import("@/pages/Connector"));

export const Route = createFileRoute("/connector")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — connector" },
      { name: "description", content: "ANGEL AI — connector" },
      { property: "og:title", content: "ANGEL AI — connector" },
      { property: "og:description", content: "ANGEL AI — connector" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Connector />;
}
