import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AttesterPanel = lazy(() => import("@/pages/AttesterPanel"));

export const Route = createFileRoute("/attester-panel")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — attester-panel" },
      { name: "description", content: "ANGEL AI — attester-panel" },
      { property: "og:title", content: "ANGEL AI — attester-panel" },
      { property: "og:description", content: "ANGEL AI — attester-panel" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AttesterPanel />;
}
