import { Heart, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

/**
 * Goan Dating is not live yet — this collects early interest so we launch it
 * once there is a balanced community, instead of an empty room.
 */
export function DatingTeaser() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: joined = false } = useQuery({
    queryKey: ["dating-interest", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("dating_interested")
        .eq("id", user!.id)
        .maybeSingle();
      return !!data?.dating_interested;
    },
  });

  const { data: count = 0 } = useQuery({
    queryKey: ["dating-interest-count"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count: c } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("dating_interested", true);
      return c ?? 0;
    },
  });

  async function join() {
    if (!user) return toast.error("Create your profile first");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ dating_interested: !joined })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["dating-interest"] });
    void qc.invalidateQueries({ queryKey: ["dating-interest-count"] });
    if (!joined) toast.success("You're on the Goan Dating early list 💚");
  }

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Heart className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">Goan Dating</p>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Real Goans and long-stayers, verified, no fakes. Opening once enough people are in —
            {count > 0 ? ` ${count} already waiting.` : " be one of the first."}
          </p>
          <button
            type="button"
            onClick={() => void join()}
            disabled={busy}
            className={`mt-3 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition-colors ${
              joined ? "bg-primary/12 text-primary" : "bg-primary text-primary-foreground"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : joined ? <Check className="h-4 w-4" /> : <Heart className="h-4 w-4" />}
            {joined ? "You're on the list" : "Notify me at launch"}
          </button>
        </div>
      </div>
    </div>
  );
}
