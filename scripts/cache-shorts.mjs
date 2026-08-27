/**
 * Daily Shorts cache builder for Goa Social.
 *
 * Goal: keep ~100 freshly downloaded Shorts on our own hosting so the feed
 * starts instantly instead of waiting on YouTube.
 *
 * How it works
 *   1. read active channels (admin-managed) + their `weight` percentage
 *   2. compute a per-channel quota from the weights and the channel count:
 *        few channels  -> many latest shorts each
 *        many channels -> 1 latest short each
 *   3. list the newest shorts per channel (latest first) and interleave
 *   4. download + compress each one; if a channel fails or runs dry the gap
 *      is filled by the next-latest short from another channel
 *   5. never download the same videoId twice on the same day (history file)
 *   6. reset every day: the history + cache are keyed by UTC date, so a new
 *      day starts from scratch with fresh latest shorts
 *   7. old clips are only deleted AFTER the new set is verified on disk
 */
import { mkdir, rm, readFile, writeFile, readdir, stat, rename, copyFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const OUT_DIR = "public/cached";
const NEXT_DIR = "public/cached-next";
const MANIFEST = "public/cached-shorts.json";
const NEXT_MANIFEST = "public/cached-shorts.next.json";
const HISTORY = "public/cached-history.json";

let MAX_CLIPS = Number(process.env.CACHE_MAX_CLIPS || 100);
const MAX_BYTES = 2_200_000;
const TODAY = new Date().toISOString().slice(0, 10);

const FALLBACK_CHANNELS = [
  { name: "Adventure Goa DK", url: "https://www.youtube.com/@adventuregoadk/shorts", icon: "🌴", priority: 1, weight: 10 },
];

async function loadEnv() {
  try {
    const txt = await readFile(".env", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
await loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function fetchChannels() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return FALLBACK_CHANNELS;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/youtube_channels?select=name,url,icon,priority,weight&active=eq.true&order=priority.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } },
    );
    if (!r.ok) throw new Error(String(r.status));
    const rows = await r.json();
    return rows.length ? rows : FALLBACK_CHANNELS;
  } catch (e) {
    console.warn("channel fetch failed:", e.message);
    return FALLBACK_CHANNELS;
  }
}

async function fetchSettings() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=value&key=eq.shorts`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

/* ---------------- daily history (no duplicate pulls within one day) --------- */

async function loadHistory() {
  try {
    const data = JSON.parse(await readFile(HISTORY, "utf8"));
    if (data?.date === TODAY && Array.isArray(data.ids)) return new Set(data.ids);
  } catch {}
  return new Set();
}

async function saveHistory(ids) {
  await writeFile(HISTORY, `${JSON.stringify({ date: TODAY, ids: [...ids] }, null, 2)}\n`);
}

/** Clips already cached today stay — we only top up to MAX_CLIPS. */
async function loadExisting(history) {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
    if (!Array.isArray(manifest) || manifest.length === 0) return [];
    if (history.size === 0) return []; // new day -> full reset
    const kept = [];
    for (const item of manifest) {
      try {
        await stat(`public${item.src}`);
        kept.push(item);
      } catch {}
    }
    return kept;
  } catch {
    return [];
  }
}

/* ---------------- yt-dlp ---------------------------------------------------- */

const CLIENT_SETS = [
  "youtube:player_client=web_safari,android_vr",
  "youtube:player_client=tv_simply,web_embedded",
  "youtube:player_client=ios,mweb",
  "youtube:player_client=android_vr,web",
];

const UAS = [
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

function ytArgs(attempt = 0) {
  return [
    "--no-warnings",
    "--ignore-config",
    "--retries", "5",
    "--fragment-retries", "5",
    "--socket-timeout", "20",
    "--sleep-requests", "1",
    "--js-runtimes", "deno",
    "--remote-components", "ejs:github",
    "--extractor-args", CLIENT_SETS[attempt % CLIENT_SETS.length],
    "--user-agent", UAS[attempt % UAS.length],
  ];
}



function shortsUrl(raw) {
  let url = raw.trim();
  if (!/^https?:/i.test(url)) url = `https://www.youtube.com/${url.replace(/^\/+/, "")}`;
  url = url.replace(/\/(videos|featured|streams|shorts)\/?$/, "");
  return `${url}/shorts`;
}

async function latestIdsFor(channel, limit) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await run(
        "yt-dlp",
        [
          "--flat-playlist",
          "--playlist-end", String(limit),
          ...ytArgs(attempt),
          "--print", "%(id)s",
          shortsUrl(channel.url),
        ],
        { maxBuffer: 20 * 1024 * 1024 },
      );
      const ids = stdout.split("\n").map((s) => s.trim()).filter((s) => /^[\w-]{11}$/.test(s));
      if (ids.length > 0) return ids;
    } catch (e) {
      console.warn(`list attempt ${attempt}/3 failed for ${channel.name}:`, e.message.split("\n")[0]);
    }
  }
  return [];
}

async function fallbackQueue(channels) {
  try {
    const videos = JSON.parse(await readFile("public/videos.json", "utf8"));
    return videos
      .filter((video) => /^[\w-]{11}$/.test(video.videoId))
      .map((video) => ({
        videoId: video.videoId,
        channel: channels.find((channel) => channel.name === video.channelName) ?? {
          name: video.channelName ?? "Goa Social",
          icon: video.channelIcon ?? "🌴",
        },
      }));
  } catch {
    return [];
  }
}

/**
 * Quota per channel from the admin weights.
 * Every channel gets at least its latest short; the remaining slots are
 * distributed proportionally to `weight` (percentage-ish share).
 */
function quotas(channels, target) {
  const n = channels.length;
  if (n === 0) return [];
  const base = Math.min(1, target);
  const remaining = Math.max(0, target - base * n);
  const totalWeight = channels.reduce((sum, c) => sum + Math.max(1, Number(c.weight) || 10), 0);
  return channels.map((c) => {
    const w = Math.max(1, Number(c.weight) || 10);
    return { channel: c, quota: base + Math.ceil((remaining * w) / totalWeight) };
  });
}

/** Round-robin across channels so the cache is a mix, priority/weight first. */
function interleave(lists, target) {
  const out = [];
  let i = 0;
  let added = true;
  const cap = target * 3;
  while (added && out.length < cap) {
    added = false;
    for (const list of lists) {
      if (list.items[i]) {
        out.push({ videoId: list.items[i], channel: list.channel });
        added = true;
      }
    }
    i += 1;
  }
  return out;
}

async function download(videoId) {
  const raw = `${NEXT_DIR}/${videoId}.src.%(ext)s`;
  let lastError;
  // Rotate player clients / user agents — YouTube blocks a single signature fast.
  for (let attempt = 0; attempt < CLIENT_SETS.length; attempt += 1) {
    try {
      await run(
        "yt-dlp",
        [
          "-f", "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[ext=mp4]/b",
          ...ytArgs(attempt),
          "--no-playlist",
          "--max-filesize", "40M",
          "-o", raw,
          `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { maxBuffer: 10 * 1024 * 1024 },
      );
      return raw;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("download failed");
}

async function compress(input, output) {
  await run("ffmpeg", [
    "-y", "-i", input,
    "-vf", "scale=-2:360",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "31",
    "-profile:v", "baseline", "-level", "3.0", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "56k", "-ac", "1",
    "-movflags", "+faststart",
    "-t", "60",
    output,
  ], { maxBuffer: 10 * 1024 * 1024 });
}

async function main() {
  await rm(NEXT_DIR, { recursive: true, force: true });
  await rm(NEXT_MANIFEST, { force: true });
  await mkdir(NEXT_DIR, { recursive: true });

  const settings = await fetchSettings();
  if (settings && settings.cachedFirst === false) {
    await writeFile(MANIFEST, "[]\n");
    console.log("cachedFirst disabled in admin settings — skipping pre-cache");
    return;
  }
  if (settings && Number(settings.maxCached) >= 0) MAX_CLIPS = Number(settings.maxCached);
  if (MAX_CLIPS === 0) {
    await writeFile(MANIFEST, "[]\n");
    console.log("maxCached = 0 — skipping pre-cache");
    return;
  }

  const history = await loadHistory();
  const existing = await loadExisting(history);
  if (history.size === 0) console.log(`new day (${TODAY}) — rebuilding the full cache`);
  else console.log(`same day — keeping ${existing.length} clips, topping up to ${MAX_CLIPS}`);

  const needed = MAX_CLIPS - existing.length;
  if (needed <= 0) {
    console.log("cache already full for today");
    await rm(NEXT_DIR, { recursive: true, force: true });
    return;
  }

  const channels = (await fetchChannels()).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  const plan = quotas(channels, needed);
  const lists = [];
  for (const { channel, quota } of plan) {
    // over-fetch heavily so gaps left by failing channels can be filled from others
    const ids = await latestIdsFor(channel, Math.min(150, quota + 40));
    lists.push({ channel, items: ids.filter((id) => !history.has(id)) });
    console.log(`${channel.name}: quota ${quota}, listed ${ids.length}`);
  }

  const listedQueue = interleave(lists, needed);
  let queue = listedQueue;
  if (queue.length === 0) {
    queue = (await fallbackQueue(channels)).filter((item) => !history.has(item.videoId));
    console.warn(`channel listing unavailable; trying ${queue.length} IDs from videos.json`);
  }

  const manifest = [];
  let cursor = 0;
  const CONCURRENCY = Number(process.env.CACHE_CONCURRENCY || 4);

  async function worker() {
    while (manifest.length < needed) {
      const item = queue[cursor++];
      if (!item) return;
      if (history.has(item.videoId)) continue;
      history.add(item.videoId); // claim it so parallel workers never duplicate
      const out = `${NEXT_DIR}/${item.videoId}.mp4`;
      let raw;
      try {
        raw = await download(item.videoId);
        const files = await readdir(NEXT_DIR);
        const actual = files.find((f) => f.startsWith(`${item.videoId}.src`));
        if (!actual) throw new Error("download completed without a media file");
        await compress(`${NEXT_DIR}/${actual}`, out);
        await rm(`${NEXT_DIR}/${actual}`, { force: true });
        const info = await stat(out);
        if (info.size > MAX_BYTES) {
          console.warn(`skipping ${item.videoId} (${Math.round(info.size / 1024)}kb too big)`);
          await rm(out, { force: true });
          continue;
        }
        manifest.push({
          videoId: item.videoId,
          src: `/cached/${item.videoId}.mp4`,
          poster: `https://i.ytimg.com/vi/${item.videoId}/hq720.jpg`,
          channelName: item.channel.name,
          channelIcon: item.channel.icon ?? "🌴",
          bytes: info.size,
        });
        console.log(`cached ${manifest.length}/${needed} ${item.videoId} (${Math.round(info.size / 1024)}kb) — ${item.channel.name}`);
      } catch (e) {
        console.warn(`failed ${item.videoId}:`, e.message.split("\n")[0]);
        if (raw) await rm(raw, { force: true }).catch(() => {});
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  if (manifest.length > needed) manifest.length = needed;

  if (manifest.length === 0) {
    await rm(NEXT_DIR, { recursive: true, force: true });
    if (existing.length > 0) {
      console.warn(`no new clips downloaded; preserving ${existing.length} previously cached shorts`);
      await saveHistory(history);
      return;
    }
    const previous = await readFile(MANIFEST, "utf8").then(JSON.parse).catch(() => []);
    if (previous.length > 0) {
      console.warn(`no new clips downloaded; preserving ${previous.length} previously cached shorts`);
      return;
    }
    throw new Error("YouTube returned no downloadable shorts and no previous cache exists");
  }

  // Carry the still-valid clips from earlier today into the new folder, then
  // swap atomically so the old set is deleted only after the new one is ready.
  for (const item of existing) {
    try {
      await copyFile(`public${item.src}`, `${NEXT_DIR}/${item.videoId}.mp4`);
    } catch {}
  }
  const finalManifest = [...manifest, ...existing].slice(0, MAX_CLIPS);

  // verify every entry exists on disk before deleting anything
  const verified = [];
  for (const item of finalManifest) {
    try {
      const info = await stat(`${NEXT_DIR}/${item.videoId}.mp4`);
      if (info.size > 0) verified.push({ ...item, bytes: info.size });
    } catch {}
  }

  await writeFile(NEXT_MANIFEST, `${JSON.stringify(verified, null, 2)}\n`);
  await rm(OUT_DIR, { recursive: true, force: true });
  await rename(NEXT_DIR, OUT_DIR);
  await copyFile(NEXT_MANIFEST, MANIFEST);
  await rm(NEXT_MANIFEST, { force: true });
  await saveHistory(history);
  console.log(`manifest published with ${verified.length} pre-cached shorts (${TODAY})`);
}

try {
  await main();
} catch (e) {
  console.error("cache-shorts failed:", e.message);
  process.exitCode = 1;
}
