import { createFileRoute } from "@tanstack/react-router";
import { lazy } from "react";
const Profile = lazy(() => import("@/pages/Profile"));

export const Route = createFileRoute("/profile/$tab")({
  head: () => ({
    meta: [
      { title: "ANGEL AI — profile/:tab" },
      { name: "description", content: "ANGEL AI — profile/:tab" },
      { property: "og:title", content: "ANGEL AI — profile/:tab" },
      { property: "og:description", content: "ANGEL AI — profile/:tab" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Profile />;
}
