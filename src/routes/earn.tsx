import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Earn = lazy(() => import("@/pages/Earn"));

export const Route = createFileRoute("/earn")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — earn" },
      { name: "description", content: "ANGEL AI — earn" },
      { property: "og:title", content: "ANGEL AI — earn" },
      { property: "og:description", content: "ANGEL AI — earn" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Earn />;
}
