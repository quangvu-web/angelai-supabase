import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const BacklogAuditPanel = lazy(() => import("@/pages/admin/BacklogAuditPanel"));

export const Route = createFileRoute("/admin/backlog-audit")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/backlog-audit" },
      { name: "description", content: "ANGEL AI — admin/backlog-audit" },
      { property: "og:title", content: "ANGEL AI — admin/backlog-audit" },
      { property: "og:description", content: "ANGEL AI — admin/backlog-audit" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <BacklogAuditPanel />;
}
