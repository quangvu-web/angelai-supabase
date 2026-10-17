import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Glossary = lazy(() => import("@/pages/Glossary"));

export const Route = createFileRoute("/glossary")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — glossary" },
      { name: "description", content: "ANGEL AI — glossary" },
      { property: "og:title", content: "ANGEL AI — glossary" },
      { property: "og:description", content: "ANGEL AI — glossary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Glossary />;
}
