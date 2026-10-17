import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Validators = lazy(() => import("@/pages/Validators"));

export const Route = createFileRoute("/validators")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — validators" },
      { name: "description", content: "ANGEL AI — validators" },
      { property: "og:title", content: "ANGEL AI — validators" },
      { property: "og:description", content: "ANGEL AI — validators" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Validators />;
}
