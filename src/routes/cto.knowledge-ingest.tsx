import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const CtoKnowledgeIngest = lazy(() => import("@/pages/cto/KnowledgeIngest"));
import { RequireCoreAccess } from "@/components/guards/RequireCoreAccess";

export const Route = createFileRoute("/cto/knowledge-ingest")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — cto/knowledge-ingest" },
      { name: "description", content: "ANGEL AI — cto/knowledge-ingest" },
      { property: "og:title", content: "ANGEL AI — cto/knowledge-ingest" },
      { property: "og:description", content: "ANGEL AI — cto/knowledge-ingest" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <RequireCoreAccess><CtoKnowledgeIngest /></RequireCoreAccess>;
}
