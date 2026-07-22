import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureMasterAdminRole } from "@/lib/admin-bootstrap.functions";

export function useAuth() {
  const ensureMasterAdmin = useServerFn(ensureMasterAdminRole);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRole(u: User | null) {
      if (!u) {
        setIsAdmin(false);
        return;
      }
      if (u.email?.toLowerCase() === "eshaanaralawrence@gmail.com") {
        try {
          await ensureMasterAdmin();
        } catch {}
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id)
        .eq("role", "admin")
        .maybeSingle();
      if (mounted) setIsAdmin(!!data);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setUser(u);
      await loadRole(u);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      await loadRole(u);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [ensureMasterAdmin]);

  return { user, isAdmin, loading };
}
