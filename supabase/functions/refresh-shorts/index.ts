import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normaliseUrl(raw: string): string {
  let url = raw.trim().replace(/[<>"]/g, "");
  if (!/^https?:/i.test(url)) {
    url = url.startsWith("@")
      ? `https://www.youtube.com/${url}`
      : `https://www.youtube.com/${url.replace(/^\/+/, "")}`;
  }
  return url.split("?")[0].replace(/\/(shorts|videos|featured|streams)\/?$/i, "").replace(/\/$/, "");
}

function extractHandle(url: string): string | null {
  const m = url.match(/@([^/]+)/);
  return m ? m[1] : null;
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ? m[1].replace(/\\u0026/g, "&").trim() : null;
}

interface FetchedChannel {
  url: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  subscribers: string | null;
  videoIds: string[];
}

async function fetchChannelShorts(channelUrl: string, maxShorts: number): Promise<FetchedChannel | null> {
  const base = normaliseUrl(channelUrl);
  try {
    const res = await fetch(`${base}/shorts`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const name =
      pick(html, /<meta property="og:title" content="([^"]+)"/) ??
      pick(html, /"channelMetadataRenderer":\{"title":"([^"]+)"/) ??
      "Unknown Channel";
    const avatarUrl =
      pick(html, /<meta property="og:image" content="([^"]+)"/) ??
      pick(html, /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/);
    const subscribers =
      pick(html, /"subscriberCountText":\{"accessibility".{0,120}?"simpleText":"([^"]+)"/) ??
      pick(html, /"([\d.,]+[KMB]? subscribers)"/);

    const ids = Array.from(new Set((html.match(/"videoId":"[\w-]{11}"/g) ?? []).map((m) => m.slice(11, -1)))).slice(0, maxShorts);

    return {
      url: `${base}/shorts`,
      name,
      handle: extractHandle(base),
      avatarUrl,
      subscribers,
      videoIds: ids,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing server config" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: channels, error: chErr } = await supabase
      .from("yt_channels")
      .select("id, channel_url, max_shorts")
      .eq("is_active", true);

    if (chErr || !channels?.length) {
      return new Response(JSON.stringify({ ok: true, fetched: 0, message: "No active channels" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalFetched = 0;
    const now = new Date().toISOString();

    for (const channel of channels) {
      const info = await fetchChannelShorts(channel.channel_url, channel.max_shorts ?? 10);
      if (!info || info.videoIds.length === 0) continue;

      const { error: updateErr } = await supabase
        .from("yt_channels")
        .update({
          channel_name: info.name,
          channel_handle: info.handle,
          avatar_url: info.avatarUrl,
          subscriber_count: info.subscribers,
          last_fetched_at: now,
        })
        .eq("id", channel.id);
      if (updateErr) console.error("channel update error", updateErr);

      const rows = info.videoIds.map((videoId) => ({
        channel_id: channel.id,
        video_id: videoId,
        fetched_at: now,
      }));

      const { error: insertErr } = await supabase
        .from("yt_shorts_pool")
        .upsert(rows, { onConflict: "channel_id,video_id", ignoreDuplicates: true });
      if (insertErr) console.error("pool insert error", insertErr);
      else totalFetched += rows.length;
    }

    return new Response(JSON.stringify({ ok: true, fetched: totalFetched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
