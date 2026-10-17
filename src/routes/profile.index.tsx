import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Profile = lazy(() => import("@/pages/Profile"));

export const Route = createFileRoute("/profile//")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — profile" },
      { name: "description", content: "ANGEL AI — profile" },
      { property: "og:title", content: "ANGEL AI — profile" },
      { property: "og:description", content: "ANGEL AI — profile" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Profile />;
}
