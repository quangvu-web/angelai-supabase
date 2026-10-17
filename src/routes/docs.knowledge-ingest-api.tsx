import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const KnowledgeIngestApi = lazy(() => import("@/pages/docs/KnowledgeIngestApi"));

export const Route = createFileRoute("/docs/knowledge-ingest-api")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — docs/knowledge-ingest-api" },
      { name: "description", content: "ANGEL AI — docs/knowledge-ingest-api" },
      { property: "og:title", content: "ANGEL AI — docs/knowledge-ingest-api" },
      { property: "og:description", content: "ANGEL AI — docs/knowledge-ingest-api" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <KnowledgeIngestApi />;
}
