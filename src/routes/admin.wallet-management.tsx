import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AdminWalletManagement = lazy(() => import("@/pages/AdminWalletManagement"));

export const Route = createFileRoute("/admin/wallet-management")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/wallet-management" },
      { name: "description", content: "ANGEL AI — admin/wallet-management" },
      { property: "og:title", content: "ANGEL AI — admin/wallet-management" },
      { property: "og:description", content: "ANGEL AI — admin/wallet-management" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminWalletManagement />;
}
