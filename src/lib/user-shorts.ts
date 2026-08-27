/**
 * Member-uploaded shorts. Unlike the daily YouTube pool (which rotates and is
 * deleted), these are permanent Goa Social content with real like counts.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Short } from "@/components/ShortsFeed";

const SIGNED_TTL = 60 * 60 * 24 * 7;

export type UserShortRow = {
  id: string;
  user_id: string;
  caption: string;
  video_path: string;
  poster_path: string | null;
  area: string | null;
  created_at: string;
};

export const uploadedVideoId = (id: string) => `u_${id}`;
export const isUploadedId = (videoId: string) => videoId.startsWith("u_");
export const uploadRowId = (videoId: string) => videoId.replace(/^u_/, "");

async function signAll(paths: string[]) {
  const map = new Map<string, string>();
  const wanted = paths.filter(Boolean);
  if (wanted.length === 0) return map;
  const { data } = await supabase.storage.from("shorts").createSignedUrls(wanted, SIGNED_TTL);
  (data ?? []).forEach((entry) => {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl);
  });
  return map;
}

async function toShorts(rows: UserShortRow[]): Promise<Short[]> {
  if (rows.length === 0) return [];
  const authorIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const [{ data: profiles }, signed] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_emoji").in("id", authorIds),
    signAll([...rows.map((r) => r.video_path), ...rows.map((r) => r.poster_path ?? "")]),
  ]);
  const authors = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows
    .map((row) => {
      const src = signed.get(row.video_path);
      if (!src) return null;
      const author = authors.get(row.user_id);
      return {
        videoId: uploadedVideoId(row.id),
        channelName: author?.display_name ?? "Goa Social member",
        channelIcon: author?.avatar_emoji ?? "🌴",
        src,
        poster: row.poster_path ? signed.get(row.poster_path) : undefined,
        source: "upload" as const,
        caption: row.caption,
        uploaderId: row.user_id,
        createdAt: row.created_at,
      } satisfies Short;
    })
    .filter(Boolean) as Short[];
}

export async function fetchUploadedShorts(limit = 40): Promise<Short[]> {
  const { data } = await supabase
    .from("user_shorts")
    .select("id, user_id, caption, video_path, poster_path, area, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  return toShorts((data ?? []) as UserShortRow[]);
}

export async function fetchUploadedShort(id: string): Promise<Short | null> {
  const { data } = await supabase
    .from("user_shorts")
    .select("id, user_id, caption, video_path, poster_path, area, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [short] = await toShorts([data as UserShortRow]);
  return short ?? null;
}

export async function fetchMyShorts(userId: string): Promise<Short[]> {
  const { data } = await supabase
    .from("user_shorts")
    .select("id, user_id, caption, video_path, poster_path, area, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return toShorts((data ?? []) as UserShortRow[]);
}
