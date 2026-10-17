import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Chat = lazy(() => import("@/pages/Chat"));

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — chat" },
      { name: "description", content: "ANGEL AI — chat" },
      { property: "og:title", content: "ANGEL AI — chat" },
      { property: "og:description", content: "ANGEL AI — chat" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Chat />;
}
