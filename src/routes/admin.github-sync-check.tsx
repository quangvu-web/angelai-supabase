import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const GitHubSyncCheck = lazy(() => import("@/pages/admin/GitHubSyncCheck"));

export const Route = createFileRoute("/admin/github-sync-check")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/github-sync-check" },
      { name: "description", content: "ANGEL AI — admin/github-sync-check" },
      { property: "og:title", content: "ANGEL AI — admin/github-sync-check" },
      { property: "og:description", content: "ANGEL AI — admin/github-sync-check" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <GitHubSyncCheck />;
}
