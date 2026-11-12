import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getLocalUser } from "@/lib/local-auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Uses the locally cached session (no network round-trip) so tapping into a
  // chat opens instantly instead of waiting on an auth API call.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? getLocalUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
