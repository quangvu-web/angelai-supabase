import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const LightConstitution = lazy(() => import("@/pages/docs/LightConstitution"));

export const Route = createFileRoute("/docs/light-constitution")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/light-constitution" },
      { name: "description", content: "ANGEL AI — docs/light-constitution" },
      { property: "og:title", content: "ANGEL AI — docs/light-constitution" },
      { property: "og:description", content: "ANGEL AI — docs/light-constitution" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <LightConstitution />;
}
