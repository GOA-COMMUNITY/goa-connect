/**
 * YouTube channel management for the admin panel.
 *
 * Channels are stored in the `yt_channels` Supabase table. Each channel has
 * a weight (higher = more of its shorts appear in the feed), an active flag,
 * and a `last_fetched_at` timestamp used by the edge function that pulls
 * latest shorts.
 *
 * The `yt_shorts_pool` table holds the individual shorts that have been
 * discovered from each channel. The home feed reads from this pool.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Short } from "@/components/ShortsFeed";

export type YTChannel = {
  id: string;
  channel_url: string;
  channel_name: string;
  channel_handle: string | null;
  avatar_url: string | null;
  subscriber_count: string | null;
  weight: number;
  is_active: boolean;
  max_shorts: number;
  last_fetched_at: string | null;
  created_at: string;
};

export type YTPoolShort = {
  id: string;
  channel_id: string;
  video_id: string;
  title: string | null;
  thumbnail: string | null;
  published_at: string | null;
  fetched_at: string;
};

/** Fetch all active channels, heaviest first. */
export async function fetchChannels(): Promise<YTChannel[]> {
  const { data, error } = await supabase
    .from("yt_channels")
    .select("*")
    .order("weight", { ascending: false });
  if (error) return [];
  return (data ?? []) as YTChannel[];
}

/** Fetch the current pool of shorts, newest first. */
export async function fetchPoolShorts(limit = 50): Promise<Short[]> {
  const { data, error } = await supabase
    .from("yt_shorts_pool")
    .select(`
      video_id,
      thumbnail,
      title,
      channel_id,
      fetched_at,
      yt_channels!inner(channel_name, channel_handle, avatar_url)
    `)
    .order("fetched_at", { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];
  return (data as any[]).map((row) => ({
    videoId: row.video_id,
    channelName: row.yt_channels?.channel_name ?? "Goa Creator",
    channelIcon: row.yt_channels?.avatar_url ? "🎥" : "🌴",
    poster: row.thumbnail ?? undefined,
    source: "youtube" as const,
  } satisfies Short));
}

/** Add a new channel. Returns the inserted row or null. */
export async function addChannel(url: string, name: string, weight = 1, maxShorts = 10): Promise<YTChannel | null> {
  const { data, error } = await supabase
    .from("yt_channels")
    .insert({
      channel_url: url,
      channel_name: name,
      weight,
      max_shorts: maxShorts,
      is_active: true,
    })
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("addChannel error", error);
    return null;
  }
  return data as YTChannel | null;
}

/** Update a channel's weight, active state, or max_shorts. */
export async function updateChannel(
  id: string,
  patch: Partial<Pick<YTChannel, "weight" | "is_active" | "max_shorts" | "channel_name">>,
): Promise<boolean> {
  const { error } = await supabase.from("yt_channels").update(patch).eq("id", id);
  return !error;
}

/** Remove a channel and its pool shorts. */
export async function removeChannel(id: string): Promise<boolean> {
  const { error: poolErr } = await supabase.from("yt_shorts_pool").delete().eq("channel_id", id);
  if (poolErr) console.error("removeChannel pool error", poolErr);
  const { error } = await supabase.from("yt_channels").delete().eq("id", id);
  return !error;
}

/** Clear all pool shorts for a channel so they can be re-fetched fresh. */
export async function clearChannelPool(channelId: string): Promise<boolean> {
  const { error } = await supabase.from("yt_shorts_pool").delete().eq("channel_id", channelId);
  return !error;
}

/** Trigger the edge function to fetch latest shorts from all active channels. */
export async function refreshAllChannels(): Promise<{ ok: boolean; message: string; fetched?: number }> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-shorts`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Refresh failed (${res.status}): ${body.slice(0, 200)}` };
    }
    const json = await res.json() as { fetched?: number };
    return { ok: true, message: "Channels refreshed", fetched: json.fetched };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Network error" };
  }
}

/** Fetch aggregate analytics for the admin overview. */
export async function fetchShortsAnalytics(): Promise<{
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalWatchMs: number;
  totalComments: number;
  byVideo: Array<{ video_id: string; views: number; likes: number; shares: number; watch_ms: number; completes: number; skips: number }>;
}> {
  const { data, error } = await supabase.rpc("shorts_analytics_summary");
  if (error || !data) {
    return { totalViews: 0, totalLikes: 0, totalShares: 0, totalWatchMs: 0, totalComments: 0, byVideo: [] };
  }
  const row = (data as any[])[0] ?? {};
  return {
    totalViews: row.total_views ?? 0,
    totalLikes: row.total_likes ?? 0,
    totalShares: row.total_shares ?? 0,
    totalWatchMs: row.total_watch_ms ?? 0,
    totalComments: row.total_comments ?? 0,
    byVideo: row.by_video ?? [],
  };
}
