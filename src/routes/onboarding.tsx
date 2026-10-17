import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Onboarding = lazy(() => import("@/pages/Onboarding"));

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — onboarding" },
      { name: "description", content: "ANGEL AI — onboarding" },
      { property: "og:title", content: "ANGEL AI — onboarding" },
      { property: "og:description", content: "ANGEL AI — onboarding" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Onboarding />;
}
