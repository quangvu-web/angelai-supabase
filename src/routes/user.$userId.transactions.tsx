import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const UserTransactionStats = lazy(() => import("@/pages/UserTransactionStats"));

export const Route = createFileRoute("/user/$userId/transactions")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — user/:userId/transactions" },
      { name: "description", content: "ANGEL AI — user/:userId/transactions" },
      { property: "og:title", content: "ANGEL AI — user/:userId/transactions" },
      { property: "og:description", content: "ANGEL AI — user/:userId/transactions" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <UserTransactionStats />;
}
