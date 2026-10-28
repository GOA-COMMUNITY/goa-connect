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
 *
 * The `yt_downloaded_shorts` table holds shorts that have been downloaded
 * from YouTube and stored in Supabase Storage, so they play from Goa Social
 * hosting instead of YouTube embeds.
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

export type DownloadSettings = {
  enabled: boolean;
  refreshIntervalDays: number;
  maxPerChannel: number;
  deleteOldAfterDays: number;
  downloadQuality: string;
};

export const defaultDownloadSettings: DownloadSettings = {
  enabled: true,
  refreshIntervalDays: 3,
  maxPerChannel: 10,
  deleteOldAfterDays: 30,
  downloadQuality: "best",
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

/** Fetch downloaded shorts that play from Goa Social hosting. */
export async function fetchDownloadedShorts(limit = 50): Promise<Short[]> {
  const { data, error } = await supabase
    .from("yt_downloaded_shorts")
    .select(`
      video_id,
      title,
      storage_path,
      poster_path,
      duration_seconds,
      channel_id,
      yt_channels!inner(channel_name, channel_handle, avatar_url)
    `)
    .eq("is_active", true)
    .order("downloaded_at", { ascending: false })
    .limit(limit);
  if (error || !data?.length) return [];

  return (data as any[]).map((row) => {
    const { data: urlData } = supabase.storage
      .from("shorts")
      .getPublicUrl(row.storage_path.replace(/^shorts\//, ""));
    return {
      videoId: row.video_id,
      channelName: row.yt_channels?.channel_name ?? "Goa Creator",
      channelIcon: row.yt_channels?.avatar_url ? "🎥" : "🌴",
      poster: row.poster_path ?? undefined,
      source: "upload" as const,
      videoUrl: urlData.publicUrl,
      duration: row.duration_seconds ?? undefined,
    } satisfies Short;
  });
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

/** Trigger the download-shorts edge function to download and store shorts. */
export async function triggerDownload(): Promise<{ ok: boolean; message: string; downloaded?: number; failed?: number; deletedOld?: number }> {
  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-shorts`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, message: `Download failed (${res.status}): ${body.slice(0, 200)}` };
    }
    const json = await res.json() as { downloaded?: number; failed?: number; deletedOld?: number };
    return {
      ok: true,
      message: "Download complete",
      downloaded: json.downloaded,
      failed: json.failed,
      deletedOld: json.deletedOld,
    };
  } catch (err: any) {
    return { ok: false, message: err?.message ?? "Network error" };
  }
}

/** Get download settings from app_settings. */
export async function getDownloadSettings(): Promise<DownloadSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shorts_download")
    .maybeSingle();
  return {
    ...defaultDownloadSettings,
    ...((data?.value as Partial<DownloadSettings> | null) ?? {}),
  };
}

/** Save download settings to app_settings. */
export async function saveDownloadSettings(settings: DownloadSettings): Promise<boolean> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "shorts_download", value: settings as any }, { onConflict: "key" });
  return !error;
}

/** Delete a downloaded short and its storage file. */
export async function deleteDownloadedShort(id: string, storagePath: string): Promise<boolean> {
  const path = storagePath.replace(/^shorts\//, "");
  await supabase.storage.from("shorts").remove([path]);
  const { error } = await supabase.from("yt_downloaded_shorts").delete().eq("id", id);
  return !error;
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
