import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chats")({
  component: ChatsLayout,
});

function ChatsLayout() {
  return <Outlet />;
}