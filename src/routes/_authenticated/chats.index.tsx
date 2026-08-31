import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, Edit3, Loader2, MessageCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { getOrCreateConversation } from "@/lib/chat";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { ChatRoom } from "@/components/ChatRoom";

export const Route = createFileRoute("/_authenticated/chats/")({
  validateSearch: (search: Record<string, unknown>) => ({
    conversation: typeof search.conversation === "string" ? search.conversation : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Messages — Goa Social" },
      { name: "description", content: "Private Goa Social conversations and local connections." },
      { property: "og:title", content: "Messages — Goa Social" },
      { property: "og:description", content: "Private Goa Social conversations and local connections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chats,
});

type Conv = {
  id: string;
  user_a: string;
  user_b: string;
  last_message: string | null;
  last_message_at: string;
  read_a_at: string | null;
  read_b_at: string | null;
};

function Chats() {
  const { conversation } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [starting, setStarting] = useState<string | null>(null);

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

  // "Start a chat" rail — people you haven't messaged yet.
  const { data: suggestions = [] } = useQuery({
    queryKey: ["chat-suggestions", user?.id, otherIds.length],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_emoji, avatar_url, area")
        .eq("is_active", true)
        .limit(30);
      if (error) throw error;
      const seen = new Set([...otherIds, user!.id]);
      return (data ?? []).filter((p) => !seen.has(p.id)).slice(0, 12);
    },
  });

  const pmap = new Map(profiles.map((p) => [p.id, p]));
  const filteredConversations = conversations.filter((c) => {
    const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
    const p = pmap.get(otherId);
    const haystack = `${p?.display_name ?? ""} ${p?.area ?? ""} ${c.last_message ?? ""}`.toLowerCase();
    return !q || haystack.includes(q.toLowerCase());
  });

  async function openChat(targetId: string) {
    if (!user) return;
    setStarting(targetId);
    try {
      const id = await getOrCreateConversation(user.id, targetId);
      qc.setQueryData(["conversation", id, user.id], {
        id,
        user_a: [user.id, targetId].sort()[0],
        user_b: [user.id, targetId].sort()[1],
      });
      void qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      await navigate({ to: "/chats", search: { conversation: id } });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setStarting(null);
    }
  }

  if (conversation) return <ChatRoom conversationId={conversation} />;

  return (
    <AppLayout>
      <div className="space-y-4 pb-4">
        <div className="sticky top-0 z-20 space-y-3 border-b border-border bg-background/85 px-4 pb-3 pt-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Messages</h1>
            <Link
              to="/explore"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft"
              aria-label="Find people to chat with"
            >
              <Edit3 className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 shadow-soft">
            <Search className="h-4.5 w-4.5 text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search chats…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {suggestions.length > 0 && (
          <section>
            <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Start a chat
            </p>
            <div className="scrollbar-hide mt-2 flex gap-4 overflow-x-auto px-4">
              {suggestions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openChat(p.id)}
                  className="w-16 shrink-0 text-center"
                  aria-label={`Message ${p.display_name}`}
                >
                  <span className="relative block">
                    <ProfileAvatar
                      url={p.avatar_url}
                      emoji={p.avatar_emoji}
                      name={p.display_name}
                      className="mx-auto h-16 w-16 ring-2 ring-primary/40"
                    />
                    <span className="absolute bottom-0 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      {starting === p.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MessageCircle className="h-3 w-3" />
                      )}
                    </span>
                  </span>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{p.display_name}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="px-4">
          {isLoading && (
            <div className="flex justify-center rounded-3xl border border-border bg-card p-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
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
                const readAt = c.user_a === user?.id ? c.read_a_at : c.read_b_at;
                const unread =
                  !!c.last_message && (!readAt || new Date(readAt) < new Date(c.last_message_at));
                return (
                  <Link
                    key={c.id}
                    to="/chats"
                    search={{ conversation: c.id }}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary/70 hover:bg-secondary/60 ${
                      i < filteredConversations.length - 1 ? "border-b border-border" : ""
                    }`}
                  >
                    <ProfileAvatar url={p?.avatar_url} emoji={p?.avatar_emoji} name={p?.display_name} className="h-13 w-13" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate font-semibold text-foreground">
                          {p?.display_name ?? "Goan"}
                        </span>
                        <span className={`ml-2 shrink-0 text-[11px] ${unread ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {formatDistanceToNowStrict(new Date(c.last_message_at))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`truncate text-sm ${unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {c.last_message ?? "Say hi 👋"}
                        </p>
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
