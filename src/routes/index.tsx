import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Index = lazy(() => import("@/pages/Index"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — Trang chủ" },
      { name: "description", content: "ANGEL AI — Trang chủ" },
      { property: "og:title", content: "ANGEL AI — Trang chủ" },
      { property: "og:description", content: "ANGEL AI — Trang chủ" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Index />;
}
