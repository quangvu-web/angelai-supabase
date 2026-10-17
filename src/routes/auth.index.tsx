import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Auth = lazy(() => import("@/pages/Auth"));

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — auth" },
      { name: "description", content: "ANGEL AI — auth" },
      { property: "og:title", content: "ANGEL AI — auth" },
      { property: "og:description", content: "ANGEL AI — auth" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Auth />;
}
