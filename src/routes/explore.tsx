import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, CheckCircle2, MapPin, MessageCircle, UserPlus, UserCheck, Loader2, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { getOrCreateConversation } from "@/lib/chat";
import { toast } from "sonner";
import { ChatRoom } from "@/components/ChatRoom";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Goans — Goa Social" },
      { name: "description", content: "Discover and connect with verified Goans across North and South Goa." },
      { property: "og:title", content: "Explore Goans — Goa Social" },
      { property: "og:description", content: "Discover and connect with verified Goans across North and South Goa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Explore,
});

const areas = ["All Goa", "Panjim", "Mapusa", "Margao", "Anjuna", "Assagao"];
const tabs = ["Discover", "Following"] as const;

type Profile = {
  id: string;
  display_name: string;
  area: string | null;
  bio: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
  username: string | null;
  is_goan: boolean | null;
  is_tourist: boolean | null;
  account_type?: string | null;
  business_name?: string | null;
  business_category?: string | null;
};

function Explore() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Discover");
  const [active, setActive] = useState("All Goa");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [openConversation, setOpenConversation] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [q]);

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      if (error) throw error;
      return data.map((d) => d.following_id);
    },
  });
  const followSet = new Set(followingIds);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles", active, debouncedQ, tab, followingIds.length],
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, display_name, area, bio, avatar_emoji, avatar_url, username, is_goan, is_tourist, is_active, account_type, business_name, business_category")
        .eq("is_active", true)
        .order("is_fake", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      if (active !== "All Goa") query = query.eq("area", active);
      if (debouncedQ) query = query.ilike("display_name", `%${debouncedQ}%`);
      if (tab === "Following") {
        if (followingIds.length === 0) return [];
        query = query.in("id", followingIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((p) => p.id !== user?.id) as Profile[];
    },
  });


  async function toggleFollow(targetId: string) {
    if (!user) return navigate({ to: "/auth" });
    if (followSet.has(targetId)) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: targetId });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["following", user.id] });
  }

  async function startChat(targetId: string) {
    if (!user) return navigate({ to: "/auth" });
    setBusy(targetId);
    try {
      const id = await getOrCreateConversation(user.id, targetId);
      qc.setQueryData(["conversation", id, user.id], {
        id,
        user_a: [user.id, targetId].sort()[0],
        user_b: [user.id, targetId].sort()[1],
      });
      setOpenConversation(id);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppLayout>
      {openConversation && (
        <ChatRoom
          conversationId={openConversation}
          onClose={() => setOpenConversation(null)}
        />
      )}
      <div className="pb-4">
        {/* Sticky search header */}
        <div className="gs-glass sticky top-0 z-20 space-y-3 border-b border-border/80 px-4 pb-3 pt-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Goa community</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground">Find your people</h1>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft transition-all focus-within:border-primary focus-within:shadow-soft">
            <Search className="h-[18px] w-[18px] text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Goans, places, vibes…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground"
              >
                <span className="text-[14px] leading-none">×</span>
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-secondary/70 p-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition-all ${
                  tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Area filter chips */}
          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
            {areas.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                  active === c
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Profile list */}
        <div className="space-y-3 p-4">
          {/* Community banner */}
          <div className="gs-tile mb-2 flex items-center gap-3 rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-card px-4 py-3 shadow-soft">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </span>
            <div className="flex-1">
              <p className="gs-gradient-text text-sm font-bold">Goa's local community</p>
              <p className="text-xs text-muted-foreground">Meet people by place, interests and vibe</p>
            </div>
          </div>

          {isLoading && (
            <div className="space-y-3 py-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="gs-shimmer h-24 rounded-3xl bg-secondary" />
              ))}
            </div>
          )}

          {!isLoading && profiles.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-soft">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                {tab === "Following"
                  ? "You're not following anyone yet — switch to Discover and follow a few Goans."
                  : "No Goans here yet. Be the first — sign up and complete your profile."}
              </p>
              <Link
                to={user ? "/profile" : "/auth"}
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-soft transition-all active:scale-95"
              >
                {user ? "Complete profile" : "Sign up"}
              </Link>
            </div>
          )}

          {/* Profile cards with staggered entrance */}
          <div className="gs-stagger space-y-3">
            {profiles.map((p) => {
              const following = followSet.has(p.id);
              return (
                <article key={p.id} className="gs-tile overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
                  <div className="flex gap-4 p-4">
                    <ProfileAvatar url={p.avatar_url} emoji={p.avatar_emoji} name={p.display_name} className="h-16 w-16" fallbackClassName="text-3xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="font-bold text-foreground">
                          {p.account_type === "business" && p.business_name ? p.business_name : p.display_name}
                        </h3>
                        {p.is_goan && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                        {p.account_type === "business" ? (
                          <span className="rounded-full bg-sunset/15 px-2 py-0.5 text-[10px] font-bold text-sunset-foreground">
                            {p.business_category ? `${p.business_category}` : "Business"}
                          </span>
                        ) : (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.is_tourist ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
                          }`}>
                            {p.is_tourist ? "Tourist" : "Goan"}
                          </span>
                        )}
                      </div>
                      {(p.area || p.username) && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> {p.area ?? "Goa"}{p.username ? ` · @${p.username}` : ""}
                        </p>
                      )}
                      {p.bio && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground/90">{p.bio}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-border/60 px-4 py-3 pl-20">
                    <button
                      onClick={() => startChat(p.id)}
                      disabled={busy === p.id}
                      className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
                    >
                      {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                      Message
                    </button>
                    <button
                      onClick={() => toggleFollow(p.id)}
                      className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all active:scale-95 ${
                        following ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"
                      }`}
                    >
                      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      {following ? "Following" : "Follow"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
