import { createFileRoute } from "@tanstack/react-router";
import { Search, Edit3 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/chats")({
  head: () => ({
    meta: [
      { title: "Messages — Goa Social" },
      { name: "description", content: "Chat with verified Goans on Goa Social." },
      { property: "og:title", content: "Messages — Goa Social" },
      { property: "og:description", content: "Chat with verified Goans on Goa Social." },
    ],
  }),
  component: Chats,
});

const chats = [
  { name: "Rohan Pereira", last: "Hey! Are you going to the beach today?", time: "5m", unread: 2, color: "from-primary to-primary-glow" },
  { name: "Anjali Naik", last: "Thanks for the art recommendation! 🎨", time: "1h", unread: 0, color: "from-pink-500 to-rose-500" },
  { name: "Vikas Gaonkar", last: "Cafe is open till 11pm tonight! ☕", time: "2h", unread: 0, color: "from-emerald-500 to-teal-600" },
  { name: "Maria D'Souza", last: "Sending you the Sao Joao photos soon", time: "1d", unread: 0, color: "from-amber-500 to-orange-600" },
  { name: "Kabir Shenoy", last: "New set dropping this weekend 🎧", time: "2d", unread: 1, color: "from-violet-500 to-fuchsia-600" },
];

function Chats() {
  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft">
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-soft">
          <Search className="h-5 w-5 text-primary" />
          <input
            placeholder="Search chats…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="rounded-3xl bg-primary/10 p-4 text-sm text-foreground">
          💬 You have <span className="font-bold text-primary">3 free messages</span> remaining today.
          Upgrade for unlimited chats with verified Goans.
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          {chats.map((c, i) => (
            <button
              key={c.name}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                i < chats.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${c.color} text-lg font-bold text-white`}>
                {c.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate font-semibold text-foreground">{c.name}</span>
                  <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">{c.time}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-muted-foreground">{c.last}</p>
                  {c.unread > 0 && (
                    <span className="ml-2 shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
