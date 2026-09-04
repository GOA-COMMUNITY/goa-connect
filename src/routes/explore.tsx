import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, CheckCircle2, MapPin, MessageCircle, UserPlus, UserCheck, Loader2, Heart, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { getOrCreateConversation } from "@/lib/chat";
import { toast } from "sonner";
import { ChatRoom } from "@/components/ChatRoom";
import { DatingTeaser } from "@/components/DatingTeaser";

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
        <div className="sticky top-0 z-20 space-y-3 border-b border-border bg-background/95 px-4 pb-3 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Goa community</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Find your people</h1>
          </div>
          <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 shadow-soft">
            <Search className="h-4.5 w-4.5 text-primary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Goans, places, vibes…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex rounded-lg bg-secondary p-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md py-2 text-sm font-semibold transition-colors ${
                  tab === t ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
            {areas.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all ${
                  active === c
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 p-4">
          <div className="mb-4 flex items-center gap-3 border-l-4 border-primary bg-card px-4 py-3 shadow-soft">
            <Users className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Goa’s local community</p>
              <p className="text-xs text-muted-foreground">Meet people by place, interests and vibe</p>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && profiles.length === 0 && (
            <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <p>
                {tab === "Following"
                  ? "You're not following anyone yet — switch to Discover and follow a few Goans."
                  : "No Goans here yet. Be the first — sign up and complete your profile."}
              </p>
              <Link
                to={user ? "/profile" : "/auth"}
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {user ? "Complete profile" : "Sign up"}
              </Link>
            </div>
          )}

          {profiles.map((p) => {
            const following = followSet.has(p.id);
            return (
              <article key={p.id} className="border-b border-border bg-card px-1 py-4 first:border-t">
                <div className="flex gap-4">
                  <ProfileAvatar url={p.avatar_url} emoji={p.avatar_emoji} name={p.display_name} className="h-16 w-16" fallbackClassName="text-3xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-semibold text-foreground">
                        {p.account_type === "business" && p.business_name ? p.business_name : p.display_name}
                      </h3>
                      {p.is_goan && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      {p.account_type === "business" ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                          {p.business_category ? `Business · ${p.business_category}` : "Business"}
                        </span>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          p.is_tourist ? "bg-secondary text-secondary-foreground" : "bg-primary/10 text-primary"
                        }`}>
                          {p.is_tourist ? "Tourist" : "Goan"}
                        </span>
                      )}
                    </div>
                    {(p.area || p.username) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {p.area ?? "Goa"}{p.username ? ` · @${p.username}` : ""}
                      </p>
                    )}
                    {p.bio && <p className="mt-1.5 line-clamp-2 text-sm text-foreground">{p.bio}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2 pl-20">
                  <button
                    onClick={() => startChat(p.id)}
                    disabled={busy === p.id}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground active:scale-[.98] disabled:opacity-60"
                  >
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    Message
                  </button>
                  <button
                    onClick={() => toggleFollow(p.id)}
                    className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold active:scale-[.98] ${
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
    </AppLayout>
  );
}
