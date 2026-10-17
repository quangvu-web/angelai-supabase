import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CorePrompts = lazy(() => import("@/pages/core/PromptGovernance"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core/prompts")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core/prompts" },
      { name: "description", content: "ANGEL AI — core/prompts" },
      { property: "og:title", content: "ANGEL AI — core/prompts" },
      { property: "og:description", content: "ANGEL AI — core/prompts" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CorePrompts /></RequireCoreAccess>;
}
