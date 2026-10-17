import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Trang trắng" },
      { name: "description", content: "Một trang trắng hoàn toàn." },
      { property: "og:title", content: "Trang trắng" },
      { property: "og:description", content: "Một trang trắng hoàn toàn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return <div className="min-h-screen bg-background" />;
}
