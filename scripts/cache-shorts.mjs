/**
 * Pre-cache the newest Shorts from the licensed Goan channels into
 * public/cached/ so the first videos in the feed play from our own
 * hosting (instant start, no YouTube round-trip).
 *
 * Runs in GitHub Actions on every scheduled build:
 *   1. read active channels from the database (admin-managed)
 *   2. take the newest shorts, shuffled across channels by priority
 *   3. download + compress to a small mp4 (<= ~1.5 MB, 360p, no audio loss)
 *   4. write public/cached-shorts.json manifest
 *
 * The cache folder is regenerated from scratch on every run, so old
 * clips are auto-deleted and no video is retained long-term.
 */
import { mkdir, rm, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const OUT_DIR = "public/cached";
const MANIFEST = "public/cached-shorts.json";
let MAX_CLIPS = Number(process.env.CACHE_MAX_CLIPS || 10);
const MAX_BYTES = 2_200_000;

const FALLBACK_CHANNELS = [
  { name: "Adventure Goa DK", url: "https://www.youtube.com/@adventuregoadk/shorts", icon: "🌴", priority: 1 },
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
      `${SUPABASE_URL}/rest/v1/youtube_channels?select=name,url,icon,priority&active=eq.true&order=priority.asc`,
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

const YT_ARGS = [
  "--no-warnings",
  "--ignore-config",
  "--retries", "5",
  "--fragment-retries", "5",
  "--socket-timeout", "20",
  "--extractor-args", "youtube:player_client=android,ios,web_safari",
  "--user-agent",
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
];

function shortsUrl(raw) {
  let url = raw.trim();
  if (!/^https?:/i.test(url)) url = `https://www.youtube.com/${url.replace(/^\/+/, "")}`;
  url = url.replace(/\/(videos|featured|streams|shorts)\/?$/, "");
  return `${url}/shorts`;
}

async function latestIdsFor(channel, limit) {
  try {
    const { stdout } = await run(
      "yt-dlp",
      [
        "--flat-playlist",
        "--playlist-end", String(limit),
        ...YT_ARGS,
        "--print", "%(id)s",
        shortsUrl(channel.url),
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    return stdout.split("\n").map((s) => s.trim()).filter((s) => /^[\w-]{11}$/.test(s));
  } catch (e) {
    console.warn(`could not list ${channel.name}:`, e.message.split("\n")[0]);
    return [];
  }
}

/** Round-robin across channels so the cache is a mix, priority order first. */
function interleave(lists) {
  const out = [];
  let i = 0;
  let added = true;
  while (added && out.length < MAX_CLIPS * 2) {
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
  const raw = `${OUT_DIR}/${videoId}.src.mp4`;
  await run(
    "yt-dlp",
    [
      "-f", "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[ext=mp4]/b",
      ...YT_ARGS,
      "--no-playlist",
      "--max-filesize", "40M",
      "-o", raw,
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return raw;
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
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

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

  const channels = (await fetchChannels()).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
  const lists = [];
  for (const channel of channels) {
    lists.push({ channel, items: await latestIdsFor(channel, MAX_CLIPS) });
  }

  const queue = interleave(lists);
  const manifest = [];

  for (const item of queue) {
    if (manifest.length >= MAX_CLIPS) break;
    const out = `${OUT_DIR}/${item.videoId}.mp4`;
    let raw;
    try {
      raw = await download(item.videoId);
      const files = await readdir(OUT_DIR);
      const actual = files.find((f) => f.startsWith(`${item.videoId}.src`));
      await compress(`${OUT_DIR}/${actual}`, out);
      await rm(`${OUT_DIR}/${actual}`, { force: true });
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
      console.log(`cached ${item.videoId} (${Math.round(info.size / 1024)}kb) — ${item.channel.name}`);
    } catch (e) {
      console.warn(`failed ${item.videoId}:`, e.message.split("\n")[0]);
      if (raw) await rm(raw, { force: true }).catch(() => {});
    }
  }

  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest written with ${manifest.length} pre-cached shorts`);
}

try {
  await main();
} catch (e) {
  console.warn("cache-shorts failed, keeping YouTube-only feed:", e.message);
  await writeFile(MANIFEST, "[]\n").catch(() => {});
}
