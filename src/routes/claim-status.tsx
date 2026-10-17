import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const ClaimStatus = lazy(() => import("@/pages/ClaimStatus"));

export const Route = createFileRoute("/claim-status")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — claim-status" },
      { name: "description", content: "ANGEL AI — claim-status" },
      { property: "og:title", content: "ANGEL AI — claim-status" },
      { property: "og:description", content: "ANGEL AI — claim-status" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <ClaimStatus />;
}
