import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRole(u: User | null) {
      if (!u) {
        if (mounted) { setIsAdmin(false); setIsStaff(false); }
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id)
        .in("role", ["admin", "moderator"]);
      const roles = (data ?? []).map((r) => r.role);
      if (mounted) { setIsAdmin(roles.includes("admin")); setIsStaff(roles.includes("admin") || roles.includes("moderator")); }
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      const u = data.user ?? null;
      setUser(u);
      await loadRole(u);
      if (mounted) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null;
      if (!mounted) return;
      setUser(u);
      await loadRole(u);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin, isStaff, loading };
}
