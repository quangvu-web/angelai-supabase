import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const EmbedChat = lazy(() => import("@/pages/embed/EmbedChat"));

export const Route = createFileRoute("/embed/chat")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — embed/chat" },
      { name: "description", content: "ANGEL AI — embed/chat" },
      { property: "og:title", content: "ANGEL AI — embed/chat" },
      { property: "og:description", content: "ANGEL AI — embed/chat" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <EmbedChat />;
}
