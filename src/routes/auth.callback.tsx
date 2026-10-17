import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AuthCallback = lazy(() => import("@/pages/AuthCallback"));

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — auth/callback" },
      { name: "description", content: "ANGEL AI — auth/callback" },
      { property: "og:title", content: "ANGEL AI — auth/callback" },
      { property: "og:description", content: "ANGEL AI — auth/callback" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AuthCallback />;
}
