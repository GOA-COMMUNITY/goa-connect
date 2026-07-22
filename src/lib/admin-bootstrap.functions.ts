import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MASTER_ADMIN_EMAIL = "eshaanaralawrence@gmail.com";

export const ensureMasterAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase() ?? "";

    if (error || email !== MASTER_ADMIN_EMAIL) {
      return { granted: false };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: context.userId, role: "admin" },
        { onConflict: "user_id,role" },
      );

    if (roleError) throw roleError;
    return { granted: true };
  });