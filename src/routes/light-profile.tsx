import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const LightProfile = lazy(() => import("@/pages/LightProfile"));

export const Route = createFileRoute("/light-profile")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — light-profile" },
      { name: "description", content: "ANGEL AI — light-profile" },
      { property: "og:title", content: "ANGEL AI — light-profile" },
      { property: "og:description", content: "ANGEL AI — light-profile" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <LightProfile />;
}
