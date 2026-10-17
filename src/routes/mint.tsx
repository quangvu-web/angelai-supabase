import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Mint = lazy(() => import("@/pages/Mint"));

export const Route = createFileRoute("/mint")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — mint" },
      { name: "description", content: "ANGEL AI — mint" },
      { property: "og:title", content: "ANGEL AI — mint" },
      { property: "og:description", content: "ANGEL AI — mint" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Mint />;
}
