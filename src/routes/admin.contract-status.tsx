import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminContractStatus = lazy(() => import("@/pages/AdminContractStatus"));

export const Route = createFileRoute("/admin/contract-status")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/contract-status" },
      { name: "description", content: "ANGEL AI — admin/contract-status" },
      { property: "og:title", content: "ANGEL AI — admin/contract-status" },
      { property: "og:description", content: "ANGEL AI — admin/contract-status" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminContractStatus />;
}
