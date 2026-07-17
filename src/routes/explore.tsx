import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, CheckCircle2, MapPin, MessageCircle, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { toast } from "sonner";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Goans — Goa Social" },
      { name: "description", content: "Discover and connect with verified Goans across North and South Goa." },
    ],
  }),
  component: Explore,
});

const chips = ["All Goans", "Panjim", "Mapusa", "Margao", "Anjuna", "Assagao"];

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
};

function Explore() {
  const [active, setActive] = useState("All Goans");
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles", active, q],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, display_name, area, bio, avatar_emoji, avatar_url, username, is_goan, is_tourist, is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (active !== "All Goans") query = query.eq("area", active);
      if (q) query = query.ilike("display_name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).filter((p) => p.id !== user?.id) as Profile[];
    },
  });

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
    const [user_a, user_b] = [user.id, targetId].sort();
    const existing = await supabase
      .from("conversations")
      .select("id")
      .eq("user_a", user_a)
      .eq("user_b", user_b)
      .maybeSingle();
    if (existing.data) {
      navigate({ to: "/chats/$id", params: { id: existing.data.id } });
      return;
    }
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_a, user_b })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    navigate({ to: "/chats/$id", params: { id: data.id } });
  }

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-soft">
          <Search className="h-5 w-5 text-primary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Goans, places, vibes…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-3 rounded-3xl bg-gradient-primary p-4 text-primary-foreground shadow-card">
          <CheckCircle2 className="h-7 w-7" />
          <div className="flex-1">
            <p className="text-sm font-bold">Only Goans Community</p>
            <p className="text-xs opacity-90">Verified Goan profiles only</p>
          </div>
        </div>

        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                active === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && profiles.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No Goans here yet. Be the first — sign up and complete your profile.
          </div>
        )}

        <div className="space-y-3">
          {profiles.map((p) => {
            const following = followSet.has(p.id);
            return (
              <div key={p.id} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
                <div className="flex gap-4">
                  <ProfileAvatar url={p.avatar_url} emoji={p.avatar_emoji} name={p.display_name} className="h-16 w-16" fallbackClassName="text-3xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="font-semibold text-foreground">{p.display_name}</h3>
                      {p.is_goan && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        p.is_tourist ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"
                      }`}>
                        {p.is_tourist ? "Tourist" : "Goan"}
                      </span>
                    </div>
                    {(p.area || p.username) && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {p.area ?? "Goa"}{p.username ? ` · @${p.username}` : ""}
                      </p>
                    )}
                    {p.bio && <p className="mt-1.5 text-sm text-foreground">{p.bio}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => startChat(p.id)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    <MessageCircle className="h-4 w-4" /> Message
                  </button>
                  <button
                    onClick={() => toggleFollow(p.id)}
                    className={`flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
                      following ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"
                    }`}
                  >
                    {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {following ? "Following" : "Follow"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
