import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminMintApproval = lazy(() => import("@/pages/AdminMintApproval"));

export const Route = createFileRoute("/admin/mint-approval")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/mint-approval" },
      { name: "description", content: "ANGEL AI — admin/mint-approval" },
      { property: "og:title", content: "ANGEL AI — admin/mint-approval" },
      { property: "og:description", content: "ANGEL AI — admin/mint-approval" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminMintApproval />;
}
