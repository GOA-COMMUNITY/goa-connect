import { supabase } from "@/integrations/supabase/client";

/** Finds or creates the 1:1 conversation between two members and returns its id. */
export async function getOrCreateConversation(meId: string, otherId: string) {
  const [user_a, user_b] = [meId, otherId].sort();
  const existing = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", user_a)
    .eq("user_b", user_b)
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
