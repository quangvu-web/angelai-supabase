import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Receipt = lazy(() => import("@/pages/Receipt"));

export const Route = createFileRoute("/receipt/$receiptId")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — receipt/:receiptId" },
      { name: "description", content: "ANGEL AI — receipt/:receiptId" },
      { property: "og:title", content: "ANGEL AI — receipt/:receiptId" },
      { property: "og:description", content: "ANGEL AI — receipt/:receiptId" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Receipt />;
}
