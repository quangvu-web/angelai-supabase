import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const AssistantEmbed = lazy(() => import("@/pages/assistant/EmbedSDK"));

export const Route = createFileRoute("/assistant/embed")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — assistant/embed" },
      { name: "description", content: "ANGEL AI — assistant/embed" },
      { property: "og:title", content: "ANGEL AI — assistant/embed" },
      { property: "og:description", content: "ANGEL AI — assistant/embed" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <AssistantEmbed />;
}
