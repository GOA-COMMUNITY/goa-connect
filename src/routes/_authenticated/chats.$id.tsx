import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chats/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/chats",
      search: { conversation: params.id },
      replace: true,
    });
  },
  head: () => ({
    meta: [
      { title: "Chat — Goa Social" },
      { name: "description", content: "A private Goa Social conversation." },
      { property: "og:title", content: "Chat — Goa Social" },
      { property: "og:description", content: "A private Goa Social conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => null,
});
