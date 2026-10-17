import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const TreasureClueAnswers = lazy(() => import("@/pages/admin/TreasureClueAnswers"));

export const Route = createFileRoute("/admin/treasure-clues")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — admin/treasure-clues" },
      { name: "description", content: "ANGEL AI — admin/treasure-clues" },
      { property: "og:title", content: "ANGEL AI — admin/treasure-clues" },
      { property: "og:description", content: "ANGEL AI — admin/treasure-clues" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <TreasureClueAnswers />;
}
