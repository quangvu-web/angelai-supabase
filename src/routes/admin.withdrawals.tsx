import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminWithdrawals = lazy(() => import("@/pages/AdminWithdrawals"));

export const Route = createFileRoute("/admin/withdrawals")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/withdrawals" },
      { name: "description", content: "ANGEL AI — admin/withdrawals" },
      { property: "og:title", content: "ANGEL AI — admin/withdrawals" },
      { property: "og:description", content: "ANGEL AI — admin/withdrawals" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminWithdrawals />;
}
