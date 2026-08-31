import { supabase } from "@/integrations/supabase/client";

/** Opening messages allowed before a mutual follow (or a reply) unlocks the chat. */
export const OPENER_LIMIT = 3;

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

export type ChatQuota = {
  /** Mutual follow (or the other person replied) — no limits. */
  unlocked: boolean;
  /** Opening messages still available right now. */
  remaining: number;
  /** True when the daily 1-message allowance is already used. */
  dailyUsed: boolean;
};

/** Works out what the fair-use rule allows for this conversation right now. */
export function computeQuota(
  myMessages: { created_at: string }[],
  theirMessageCount: number,
  mutualFollow: boolean,
): ChatQuota {
  if (mutualFollow || theirMessageCount > 0) {
    return { unlocked: true, remaining: Infinity, dailyUsed: false };
  }
  const sent = myMessages.length;
  if (sent < OPENER_LIMIT) {
    return { unlocked: false, remaining: OPENER_LIMIT - sent, dailyUsed: false };
  }
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const dailyUsed = myMessages.some((m) => new Date(m.created_at).getTime() > cutoff);
  return { unlocked: false, remaining: dailyUsed ? 0 : 1, dailyUsed };
}

/** Marks the conversation as read for the current viewer. */
export async function markConversationRead(conversationId: string, isUserA: boolean) {
  await supabase
    .from("conversations")
    .update(isUserA ? { read_a_at: new Date().toISOString() } : { read_b_at: new Date().toISOString() })
    .eq("id", conversationId);
}
