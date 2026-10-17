import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const DigitalConstitution = lazy(() => import("@/pages/docs/DigitalConstitution"));

export const Route = createFileRoute("/docs/digital-constitution")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/digital-constitution" },
      { name: "description", content: "ANGEL AI — docs/digital-constitution" },
      { property: "og:title", content: "ANGEL AI — docs/digital-constitution" },
      { property: "og:description", content: "ANGEL AI — docs/digital-constitution" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <DigitalConstitution />;
}
