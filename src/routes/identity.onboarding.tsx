import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const OnboardingWizard = lazy(() => import("@/components/identity/onboarding/OnboardingWizard"));

export const Route = createFileRoute("/identity/onboarding")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — identity/onboarding" },
      { name: "description", content: "ANGEL AI — identity/onboarding" },
      { property: "og:title", content: "ANGEL AI — identity/onboarding" },
      { property: "og:description", content: "ANGEL AI — identity/onboarding" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <OnboardingWizard />;
}
