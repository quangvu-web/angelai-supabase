import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const NotificationTemplates = lazy(() => import("@/pages/admin/NotificationTemplates"));

export const Route = createFileRoute("/admin/notification-templates")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/notification-templates" },
      { name: "description", content: "ANGEL AI — admin/notification-templates" },
      { property: "og:title", content: "ANGEL AI — admin/notification-templates" },
      { property: "og:description", content: "ANGEL AI — admin/notification-templates" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <NotificationTemplates />;
}
