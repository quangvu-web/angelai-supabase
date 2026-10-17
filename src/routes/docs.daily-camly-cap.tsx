import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const DailyCamlyCap = lazy(() => import("@/pages/docs/DailyCamlyCap"));

export const Route = createFileRoute("/docs/daily-camly-cap")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/daily-camly-cap" },
      { name: "description", content: "ANGEL AI — docs/daily-camly-cap" },
      { property: "og:title", content: "ANGEL AI — docs/daily-camly-cap" },
      { property: "og:description", content: "ANGEL AI — docs/daily-camly-cap" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <DailyCamlyCap />;
}
