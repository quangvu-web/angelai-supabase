import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Glossary = lazy(() => import("@/pages/Glossary"));

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — faq" },
      { name: "description", content: "ANGEL AI — faq" },
      { property: "og:title", content: "ANGEL AI — faq" },
      { property: "og:description", content: "ANGEL AI — faq" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Glossary />;
}
