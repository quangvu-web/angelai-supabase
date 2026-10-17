import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — reset-password" },
      { name: "description", content: "ANGEL AI — reset-password" },
      { property: "og:title", content: "ANGEL AI — reset-password" },
      { property: "og:description", content: "ANGEL AI — reset-password" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ResetPassword />;
}
