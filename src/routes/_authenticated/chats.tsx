import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Edit3 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { formatDistanceToNowStrict } from "date-fns";

export const Route = createFileRoute("/_authenticated/chats")({
  head: () => ({
    meta: [{ title: "Messages — Goa Social" }],
  }),
  component: Chats,
});

type Conv = {
  id: string;
  user_a: string;
  user_b: string;
  last_message: string | null;
  last_message_at: string;
};

function Chats() {
  const { user } = useAuth();
  const [q, setQ] = useState("");

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as Conv[];
    },
  });

  const otherIds = Array.from(
    new Set(conversations.map((c) => (c.user_a === user?.id ? c.user_b : c.user_a))),
  );

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-bulk", otherIds.sort().join(",")],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_emoji, avatar_url, area")
        .in("id", otherIds);
      if (error) throw error;
      return data;
    },
  });
  const pmap = new Map(profiles.map((p) => [p.id, p]));
  const filteredConversations = conversations.filter((c) => {
    const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
    const p = pmap.get(otherId);
    const haystack = `${p?.display_name ?? ""} ${p?.area ?? ""} ${c.last_message ?? ""}`.toLowerCase();
    return !q || haystack.includes(q.toLowerCase());
  });

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Messages</h1>
          <Link
            to="/explore"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
            aria-label="Find people to chat with"
          >
            <Edit3 className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-soft">
          <Search className="h-5 w-5 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chats…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {isLoading && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No conversations yet.</p>
            <Link
              to="/explore"
              className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Find Goans to message
            </Link>
          </div>
        )}

        {!isLoading && conversations.length > 0 && filteredConversations.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No chats match your search.
          </div>
        )}

        {filteredConversations.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            {filteredConversations.map((c, i) => {
              const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
              const p = pmap.get(otherId);
              return (
                <Link
                  key={c.id}
                  to="/chats/$id"
                  params={{ id: c.id }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                    i < filteredConversations.length - 1 ? "border-b border-border" : ""
                  }`}
                >
                  <ProfileAvatar url={p?.avatar_url} emoji={p?.avatar_emoji} name={p?.display_name} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-semibold text-foreground">
                        {p?.display_name ?? "Goan"}
                      </span>
                      <span className="ml-2 shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNowStrict(new Date(c.last_message_at))}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.last_message ?? "Say hi 👋"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
