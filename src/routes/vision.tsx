import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Vision = lazy(() => import("@/pages/Vision"));

export const Route = createFileRoute("/vision")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — vision" },
      { name: "description", content: "ANGEL AI — vision" },
      { property: "og:title", content: "ANGEL AI — vision" },
      { property: "og:description", content: "ANGEL AI — vision" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Vision />;
}
