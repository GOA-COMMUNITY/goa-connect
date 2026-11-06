import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Heart, MapPin, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getOrCreateConversation } from "@/lib/chat";

export const Route = createFileRoute("/dating")({
  head: () => ({
    meta: [
      { title: "Goan Dating — Goa Social" },
      { name: "description", content: "Meet real people in Goa — locals and visitors — and start a friendly chat." },
      { property: "og:title", content: "Goan Dating — Goa Social" },
      { property: "og:description", content: "Meet real people in Goa — locals and visitors — and start a friendly chat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DatingPage,
});

type DatingProfile = {
  id: string; display_name: string; area: string | null; bio: string | null;
  avatar_emoji: string | null; avatar_url: string | null; is_goan: boolean; is_tourist: boolean;
};

function DatingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "goan" | "visitor">("all");
  const [busy, setBusy] = useState(false);

  const { data: enabled = true } = useQuery({
    queryKey: ["setting", "dating_enabled"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "dating_enabled").maybeSingle();
      return data ? data.value !== false : true;
    },
  });

  const { data: me } = useQuery({
    queryKey: ["dating-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("dating_interested").eq("id", user!.id).maybeSingle();
      return !!data?.dating_interested;
    },
  });

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["dating-people"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, area, bio, avatar_emoji, avatar_url, is_goan, is_tourist")
        .eq("dating_interested", true).eq("is_active", true).eq("is_fake", false)
        .order("updated_at", { ascending: false }).limit(100);
      return (data ?? []) as DatingProfile[];
    },
  });

  const list = people
    .filter((p) => p.id !== user?.id)
    .filter((p) => filter === "all" || (filter === "goan" ? p.is_goan : p.is_tourist));

  async function toggleMe() {
    if (!user) return navigate({ to: "/auth" });
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ dating_interested: !me }).eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(!me ? "You're now visible in Goan Dating 💛" : "You're hidden from dating");
    qc.invalidateQueries({ queryKey: ["dating-me"] });
    qc.invalidateQueries({ queryKey: ["dating-people"] });
  }

  async function sayHi(id: string) {
    if (!user) return navigate({ to: "/auth" });
    try {
      const cid = await getOrCreateConversation(user.id, id);
      navigate({ to: "/chats/$id", params: { id: cid } });
    } catch (e) { toast.error((e as Error).message); }
  }

  function share() {
    const text = "Meet real people in Goa on Goa Social 💛 https://goasocial.in/dating";
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
          <Heart className="h-7 w-7" />
          <h1 className="mt-2 text-2xl font-bold">Goan Dating</h1>
          <p className="text-sm opacity-90">Real people, real Goa. Say hi kindly — chats unlock when they reply.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy} onClick={toggleMe} className="rounded-full bg-background px-4 py-2 text-sm font-semibold text-foreground">
              {me ? "Hide me from dating" : "Join Goan Dating"}
            </button>
            <button onClick={share} className="flex items-center gap-1 rounded-full border border-primary-foreground/40 px-4 py-2 text-sm font-semibold">
              <Share2 className="h-4 w-4" /> Invite on WhatsApp
            </button>
          </div>
        </div>

        {!enabled ? (
          <p className="mt-8 text-center text-muted-foreground">Goan Dating is taking a short break. Back soon!</p>
        ) : (
          <>
            <div className="mt-5 flex gap-2">
              {(["all", "goan", "visitor"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {f === "all" ? "Everyone" : f === "goan" ? "Goans" : "Visitors"}
                </button>
              ))}
            </div>
            {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : list.length === 0 ? (
              <p className="mt-8 text-center text-muted-foreground">No one here yet — be the first and invite friends!</p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {list.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? <img src={p.avatar_url} alt={p.display_name} className="h-14 w-14 rounded-full object-cover" />
                        : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-2xl">{p.avatar_emoji ?? "🌴"}</div>}
                      <div>
                        <p className="font-bold">{p.display_name}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.area ?? "Goa"}</p>
                        <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {p.is_goan ? "Goan" : p.is_tourist ? "Visitor" : "Living in Goa"}
                        </span>
                      </div>
                    </div>
                    {p.bio && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{p.bio}</p>}
                    <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-foreground">
                      💬 Ask: {ICEBREAKERS[[...p.id].reduce((a, c) => a + c.charCodeAt(0), 0) % ICEBREAKERS.length]}
                    </p>
                    <button onClick={() => sayHi(p.id)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">
                      <MessageCircle className="h-4 w-4" /> Say hi
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

const ICEBREAKERS = [
  "Best fish thali spot in Goa?",
  "North Goa or South Goa?",
  "Favourite sunset viewpoint?",
  "Feni, Kings or chai?",
  "Best beach shack you have found?",
  "Go-to monsoon hangout?",
  "Sorpotel or xacuti?",
];
