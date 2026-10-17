import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const ProofUpload = lazy(() => import("@/pages/ProofUpload"));

export const Route = createFileRoute("/proof-upload")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — proof-upload" },
      { name: "description", content: "ANGEL AI — proof-upload" },
      { property: "og:title", content: "ANGEL AI — proof-upload" },
      { property: "og:description", content: "ANGEL AI — proof-upload" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ProofUpload />;
}
