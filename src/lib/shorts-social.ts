/**
 * Real social signals for shorts (likes, comments, analytics events).
 * Counts are genuine — a brand-new short starts at 0.
 */
import { supabase } from "@/integrations/supabase/client";

export type ShortSource = "youtube" | "upload";
export type EventKind =
  | "view"
  | "watch"
  | "like"
  | "unlike"
  | "share"
  | "skip"
  | "complete"
  | "comment";

export type ShortComment = {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: { display_name: string; avatar_url: string | null; avatar_emoji: string | null } | null;
};

export function shareUrlFor(videoId: string) {
  const origin = typeof window === "undefined" ? "https://goasocial.in" : window.location.origin;
  return `${origin}/s/${encodeURIComponent(videoId)}`;
}

export async function fetchLikeState(videoIds: string[], userId?: string | null) {
  const counts: Record<string, number> = {};
  const mine = new Set<string>();
  if (videoIds.length === 0) return { counts, mine };
  const { data } = await supabase
    .from("short_likes")
    .select("video_id, user_id")
    .in("video_id", videoIds);
  (data ?? []).forEach((row) => {
    counts[row.video_id] = (counts[row.video_id] ?? 0) + 1;
    if (userId && row.user_id === userId) mine.add(row.video_id);
  });
  videoIds.forEach((id) => {
    if (counts[id] === undefined) counts[id] = 0;
  });
  return { counts, mine };
}

export async function setLike(videoId: string, userId: string, liked: boolean) {
  if (liked) {
    await supabase.from("short_likes").upsert({ video_id: videoId, user_id: userId });
  } else {
    await supabase.from("short_likes").delete().eq("video_id", videoId).eq("user_id", userId);
  }
}

export async function fetchCommentCounts(videoIds: string[]) {
  const counts: Record<string, number> = {};
  if (videoIds.length === 0) return counts;
  const { data } = await supabase.from("short_comments").select("video_id").in("video_id", videoIds);
  (data ?? []).forEach((row) => {
    counts[row.video_id] = (counts[row.video_id] ?? 0) + 1;
  });
  videoIds.forEach((id) => {
    if (counts[id] === undefined) counts[id] = 0;
  });
  return counts;
}

export async function fetchComments(videoId: string): Promise<ShortComment[]> {
  const { data } = await supabase
    .from("short_comments")
    .select("id, video_id, user_id, body, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as ShortComment[];
  const ids = Array.from(new Set(rows.map((row) => row.user_id)));
  if (ids.length === 0) return rows;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, avatar_emoji")
    .in("id", ids);
  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((row) => ({ ...row, author: map.get(row.user_id) ?? null }));
}

export async function addComment(videoId: string, userId: string, body: string) {
  const { error } = await supabase
    .from("short_comments")
    .insert({ video_id: videoId, user_id: userId, body: body.slice(0, 500) });
  if (error) throw error;
}

/** Fire-and-forget analytics signal that powers the admin algorithm engine. */
export function logShortEvent(
  videoId: string,
  kind: EventKind,
  source: ShortSource = "youtube",
  watchMs = 0,
  userId?: string | null,
) {
  try {
    void supabase
      .from("short_events")
      .insert({
        video_id: videoId,
        kind,
        source,
        watch_ms: Math.max(0, Math.round(watchMs)),
        user_id: userId ?? null,
      })
      .then(() => undefined, () => undefined);
  } catch {
    /* analytics must never break playback */
  }
}
