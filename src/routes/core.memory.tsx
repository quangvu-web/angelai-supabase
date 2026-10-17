import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CoreMemory = lazy(() => import("@/pages/core/Memory"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/core/memory")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — core/memory" },
      { name: "description", content: "ANGEL AI — core/memory" },
      { property: "og:title", content: "ANGEL AI — core/memory" },
      { property: "og:description", content: "ANGEL AI — core/memory" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CoreMemory /></RequireCoreAccess>;
}
