import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const NotificationAudit = lazy(() => import("@/pages/admin/NotificationAudit"));

export const Route = createFileRoute("/admin/notification-audit")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/notification-audit" },
      { name: "description", content: "ANGEL AI — admin/notification-audit" },
      { property: "og:title", content: "ANGEL AI — admin/notification-audit" },
      { property: "og:description", content: "ANGEL AI — admin/notification-audit" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <NotificationAudit />;
}
