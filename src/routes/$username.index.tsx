import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const DynamicRoute = lazy(() => import("@/pages/DynamicRoute"));

export const Route = createFileRoute("/$username/")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — :username" },
      { name: "description", content: "ANGEL AI — :username" },
      { property: "og:title", content: "ANGEL AI — :username" },
      { property: "og:description", content: "ANGEL AI — :username" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <DynamicRoute />;
}
