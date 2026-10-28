/**
 * Downloads latest YouTube shorts from all active channels, stores them in
 * Supabase Storage, and records metadata in yt_downloaded_shorts. Old shorts
 * beyond the retention period are deleted automatically.
 *
 * Designed to be called by a GitHub Actions cron every N days (configurable
 * via app_settings: shorts_download.refreshIntervalDays).
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normaliseUrl(raw: string): string {
  let url = raw.trim().replace(/[<>"]/g, "");
  if (!/^https?:/i.test(url)) {
    url = url.startsWith("@")
      ? `https://www.youtube.com/${url}`
      : `https://www.youtube.com/${url.replace(/^\/+/, "")}`;
  }
  return url.split("?")[0].replace(/\/(shorts|videos|featured|streams)\/?$/i, "").replace(/\/$/, "");
}

async function fetchChannelVideoIds(channelUrl: string, maxShorts: number): Promise<string[]> {
  const base = normaliseUrl(channelUrl);
  const res = await fetch(`${base}/shorts`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const ids = Array.from(
    new Set((html.match(/"videoId":"[\w-]{11}"/g) ?? []).map((m) => m.slice(11, -1))),
  ).slice(0, maxShorts);
  return ids;
}

async function downloadVideo(videoId: string): Promise<{ path: string; size: number; duration: number; title: string } | null> {
  const url = `https://www.youtube.com/shorts/${videoId}`;
  const tmpPath = `/tmp/${videoId}.mp4`;

  const args = [
    "-f", "best[height<=720][ext=mp4]/best[ext=mp4]/best",
    "--no-playlist",
    "--no-warnings",
    "--no-progress",
    "--print-json",
    "-o", tmpPath,
    url,
  ];

  const cmd = new Deno.Command("yt-dlp", {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  try {
    const { success, stdout } = await cmd.output();
    if (!success) {
      console.error(`yt-dlp failed for ${videoId}`);
      return null;
    }
    const info = JSON.parse(new TextDecoder().decode(stdout));
    const stat = await Deno.stat(tmpPath);
    return {
      path: tmpPath,
      size: stat.size,
      duration: Math.round(info.duration ?? 0),
      title: info.title ?? videoId,
    };
  } catch (err) {
    console.error(`download error for ${videoId}:`, err);
    return null;
  }
}

async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  videoId: string,
  localPath: string,
): Promise<string | null> {
  const storagePath = `downloads/${videoId}.mp4`;
  const fileData = await Deno.readFile(localPath);
  const { error } = await supabase.storage
    .from("shorts")
    .upload(storagePath, fileData, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (error) {
    console.error(`storage upload error for ${videoId}:`, error);
    return null;
  }
  return storagePath;
}

async function deleteOldShorts(
  supabase: ReturnType<typeof createClient>,
  deleteAfterDays: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - deleteAfterDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: old, error } = await supabase
    .from("yt_downloaded_shorts")
    .select("id, storage_path")
    .lt("downloaded_at", cutoff);
  if (error || !old?.length) return 0;

  let deleted = 0;
  for (const row of old) {
    if (row.storage_path) {
      const path = row.storage_path.replace(/^shorts\//, "");
      await supabase.storage.from("shorts").remove([path]);
    }
    await supabase.from("yt_downloaded_shorts").delete().eq("id", row.id);
    deleted++;
  }
  return deleted;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing server config" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Read download settings
    const { data: settingsRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "shorts_download")
      .maybeSingle();
    const settings = settingsRow?.value ?? {};
    const enabled = settings.enabled !== false;
    const maxPerChannel = settings.maxPerChannel ?? 10;
    const deleteAfterDays = settings.deleteOldAfterDays ?? 30;

    if (!enabled) {
      return json({ ok: true, message: "Downloads disabled", downloaded: 0 });
    }

    // Get active channels
    const { data: channels, error: chErr } = await supabase
      .from("yt_channels")
      .select("id, channel_url, channel_name, max_shorts")
      .eq("is_active", true);
    if (chErr || !channels?.length) {
      return json({ ok: true, downloaded: 0, message: "No active channels" });
    }

    // Get already-downloaded video IDs to skip duplicates
    const { data: existing } = await supabase
      .from("yt_downloaded_shorts")
      .select("video_id");
    const existingIds = new Set((existing ?? []).map((r: { video_id: string }) => r.video_id));

    let totalDownloaded = 0;
    let totalFailed = 0;
    const results: Array<{ channel: string; downloaded: number; failed: number }> = [];

    for (const channel of channels) {
      const limit = channel.max_shorts ?? maxPerChannel;
      const videoIds = await fetchChannelVideoIds(channel.channel_url, limit);
      let channelDownloaded = 0;
      let channelFailed = 0;

      for (const videoId of videoIds) {
        if (existingIds.has(videoId)) continue;

        const downloaded = await downloadVideo(videoId);
        if (!downloaded) {
          channelFailed++;
          totalFailed++;
          continue;
        }

        const storagePath = await uploadToStorage(supabase, videoId, downloaded.path);
        if (!storagePath) {
          channelFailed++;
          totalFailed++;
          continue;
        }

        const { error: insertErr } = await supabase
          .from("yt_downloaded_shorts")
          .insert({
            channel_id: channel.id,
            video_id: videoId,
            title: downloaded.title,
            storage_path: storagePath,
            file_size_bytes: downloaded.size,
            duration_seconds: downloaded.duration,
            is_active: true,
          });
        if (insertErr) {
          console.error(`insert error for ${videoId}:`, insertErr);
          channelFailed++;
          totalFailed++;
        } else {
          existingIds.add(videoId);
          channelDownloaded++;
          totalDownloaded++;
        }

        // Clean up temp file
        try { await Deno.remove(downloaded.path); } catch { /* ignore */ }
      }

      results.push({
        channel: channel.channel_name ?? channel.channel_url,
        downloaded: channelDownloaded,
        failed: channelFailed,
      });

      // Update last_fetched_at
      await supabase
        .from("yt_channels")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", channel.id);
    }

    // Delete old shorts beyond retention period
    const deletedCount = await deleteOldShorts(supabase, deleteAfterDays);

    return json({
      ok: true,
      downloaded: totalDownloaded,
      failed: totalFailed,
      deletedOld: deletedCount,
      channels: results,
    });
  } catch (err) {
    console.error("download-shorts error:", err);
    return json({ error: err instanceof Error ? err.message : "unknown error" }, 500);
  }
});
