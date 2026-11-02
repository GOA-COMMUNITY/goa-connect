/**
 * Shorts cache builder for Goa Social.
 *
 * Goal: keep up to `maxCached` (default 50) downloaded Shorts on our own
 * hosting so the feed starts instantly instead of waiting on YouTube.
 *
 * How it works
 *   1. read active channels (admin-managed) from the database
 *   2. every channel contributes at most its `perChannel` (default 5) LATEST
 *      shorts — never older uploads
 *   3. a download pass runs once every `refreshDays` (default 2) days; every
 *      other run only tidies the pool (retention sweep)
 *   4. a video that is already downloaded is NEVER downloaded again: the
 *      history file remembers every downloaded id permanently
 *   5. clips older than `retentionDays` (default 30) days — counted from the
 *      day we downloaded them — are deleted from the pool
 *   6. old files are deleted only AFTER the new pool is verified on disk
 *
 * All numbers are admin settings in the `app_settings` row with key `shorts`:
 * cachedFirst, autoRefresh, maxCached, refreshDays, perChannel, retentionDays,
 * embedsEnabled.
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

let MAX_CLIPS = Number(process.env.CACHE_MAX_CLIPS || 50);
const MAX_BYTES = 2_200_000;
const TODAY = new Date().toISOString().slice(0, 10);

const FALLBACK_CHANNELS = [
  { name: "Adventure Goa DK", url: "https://www.youtube.com/@adventuregoadk/shorts", icon: "🌴", priority: 1, weight: 10 },
];

/** Defaults when the admin settings row is missing or stale. */
const defaultSettings = {
  cachedFirst: true,
  maxCached: 50,
  refreshDays: 2,
  perChannel: 5,
  retentionDays: 30,
};

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

/* ---------------- persistent download history ------------------------------
 * One entry per video ever downloaded, with the UTC day it was downloaded.
 * Nothing here is ever reset by date: a downloaded short is never pulled
 * again, and the download day is what the retention sweep counts from.
 * Legacy v1 files ({ date, ids }) are folded in with that day as the date.
 * -------------------------------------------------------------------------- */

async function loadHistory() {
  try {
    const data = JSON.parse(await readFile(HISTORY, "utf8"));
    const downloads = new Map();
    if (data?.downloads && typeof data.downloads === "object") {
      for (const [id, date] of Object.entries(data.downloads)) {
        if (/^[\w-]{11}$/.test(id) && typeof date === "string") downloads.set(id, date.slice(0, 10));
      }
    } else if (data?.date && Array.isArray(data.ids)) {
      for (const id of data.ids) {
        if (/^[\w-]{11}$/.test(id)) downloads.set(id, String(data.date).slice(0, 10));
      }
    }
    const lastRun = typeof data?.lastRun === "string" ? data.lastRun.slice(0, 10) : null;
    return { lastRun, downloads };
  } catch {
    return { lastRun: null, downloads: new Map() };
  }
}

async function saveHistory(downloads, lastRun) {
  // cap so the file never grows without bound: drop the oldest entries first
  const CAP = 4000;
  if (downloads.size > CAP) {
    const entries = [...downloads.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1));
    for (const [id] of entries.slice(0, downloads.size - CAP)) downloads.delete(id);
  }
  await writeFile(
    HISTORY,
    `${JSON.stringify({ version: 2, lastRun, downloads: Object.fromEntries(downloads) }, null, 2)}\n`,
  );
}

function daysSince(dateStr) {
  const then = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86400000);
}

/** Clips already on disk stay — we never delete and re-download. */
async function loadExisting() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
    if (!Array.isArray(manifest)) return [];
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

/**
 * Quota per channel from the admin weights, capped at `perChannel`.
 * With perChannel = 5 every channel can contribute at most 5 clips, and only
 * from its 5 latest shorts — older uploads are never considered.
 */
function quotas(channels, target, perChannel = 0) {
  const n = channels.length;
  if (n === 0) return [];
  const base = Math.min(1, target);
  const remaining = Math.max(0, target - base * n);
  const totalWeight = channels.reduce((sum, c) => sum + Math.max(1, Number(c.weight) || 10), 0);
  return channels.map((c) => {
    const w = Math.max(1, Number(c.weight) || 10);
    let quota = base + Math.ceil((remaining * w) / totalWeight);
    if (perChannel > 0) quota = Math.min(quota, perChannel);
    return { channel: c, quota };
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
  const settings = await fetchSettings();
  // Admin settings win — but only if they were saved by the new admin panel
  // (marked by retentionDays). A stale pre-existing row must not silently keep
  // the old behaviour (100/day, daily rebuild).
  const saved = settings ?? {};
  const savedByNewPanel = saved.retentionDays !== undefined || saved.refreshDays !== undefined;
  const merged = savedByNewPanel ? saved : { ...saved, ...defaultSettings };

  if (merged.cachedFirst === false) {
    await writeFile(MANIFEST, "[]\n");
    console.log("cachedFirst disabled in admin settings — skipping pre-cache");
    return;
  }
  if (Number(merged.maxCached) >= 0) MAX_CLIPS = Number(merged.maxCached);
  const REFRESH_DAYS = Math.max(1, Number(merged.refreshDays) || 1);
  const PER_CHANNEL = Math.max(0, Number(merged.perChannel) || 0);
  const RETENTION_DAYS = Math.max(1, Number(merged.retentionDays) || 30);
  if (!savedByNewPanel) {
    console.log("admin settings row is stale — using the new defaults (50 max, every 2 days, 5 per channel, 30-day retention)");
  }
  console.log(
    `max ${MAX_CLIPS} shorts, download pass every ${REFRESH_DAYS} day(s), ` +
    `max ${PER_CHANNEL || "auto"} per channel, auto-delete after ${RETENTION_DAYS} day(s)`,
  );
  if (MAX_CLIPS === 0) {
    await writeFile(MANIFEST, "[]\n");
    console.log("maxCached = 0 — skipping pre-cache");
    return;
  }

  const { lastRun, downloads } = await loadHistory();
  const existing = await loadExisting();

  // Retention sweep: clips older than the limit (from their download day) go.
  // Unknown-age clips (legacy pools) are stamped with today so they age out
  // from now on instead of disappearing immediately.
  const kept = [];
  const expired = [];
  for (const item of existing) {
    const when = downloads.get(item.videoId) ?? TODAY;
    downloads.set(item.videoId, when);
    (daysSince(when) <= RETENTION_DAYS ? kept : expired).push(item);
  }
  if (expired.length > 0) {
    console.log(`retention: ${expired.length} clip(s) older than ${RETENTION_DAYS} day(s) will be deleted`);
  }

  // A download pass is due only once every REFRESH_DAYS days.
  const due = !lastRun || daysSince(lastRun) >= REFRESH_DAYS;
  if (!due) {
    console.log(`download pass not due (last run ${lastRun}) — keeping ${kept.length} clips`);
  }

  let downloaded = [];
  let ranDownloadPass = false;

  if (due && kept.length < MAX_CLIPS) {
    ranDownloadPass = true;
    await rm(NEXT_DIR, { recursive: true, force: true });
    await mkdir(NEXT_DIR, { recursive: true });

    const needed = MAX_CLIPS - kept.length;
    const channels = (await fetchChannels()).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
    const plan = quotas(channels, needed, PER_CHANNEL);
    const lists = [];
    for (const { channel } of plan) {
      // Only ever look at a channel's newest `limit` shorts — nothing older.
      const limit = PER_CHANNEL > 0 ? PER_CHANNEL : Math.min(150, MAX_CLIPS + 40);
      const ids = await latestIdsFor(channel, limit);
      const fresh = ids.filter((id) => !downloads.has(id));
      lists.push({ channel, items: fresh });
      console.log(`${channel.name}: listed ${ids.length} latest, ${fresh.length} not downloaded yet`);
    }

    const queue = interleave(lists, needed);
    const manifest = [];
    let cursor = 0;
    const attempted = new Set();
    const CONCURRENCY = Number(process.env.CACHE_CONCURRENCY || 4);

    async function worker() {
      while (manifest.length < needed) {
        const item = queue[cursor++];
        if (!item) return;
        if (downloads.has(item.videoId) || attempted.has(item.videoId)) continue;
        attempted.add(item.videoId); // claim it so parallel workers never duplicate
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
          // only successful downloads count as "seen" — failures retry next pass
          downloads.set(item.videoId, TODAY);
          console.log(`cached ${manifest.length}/${needed} ${item.videoId} (${Math.round(info.size / 1024)}kb) — ${item.channel.name}`);
        } catch (e) {
          console.warn(`failed ${item.videoId}:`, e.message.split("\n")[0]);
          if (raw) await rm(raw, { force: true }).catch(() => {});
          await rm(out, { force: true }).catch(() => {});
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    if (manifest.length > needed) manifest.length = needed;
    downloaded = manifest;

    // Carry the kept clips into the new folder, then swap atomically so the
    // old set is deleted only after the new one is ready.
    for (const item of kept) {
      try {
        await copyFile(`public${item.src}`, `${NEXT_DIR}/${item.videoId}.mp4`);
      } catch {}
    }
  } else if (due) {
    console.log(`pool already at ${kept.length}/${MAX_CLIPS} — nothing new to download`);
  }

  const finalSet = new Map();
  for (const item of [...downloaded, ...kept]) {
    if (!finalSet.has(item.videoId)) finalSet.set(item.videoId, item);
  }
  const finalManifest = [...finalSet.values()].slice(0, MAX_CLIPS);

  if (downloaded.length > 0) {
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
    console.log(`manifest published with ${verified.length} shorts (download pass ${TODAY})`);
  } else if (ranDownloadPass) {
    await rm(NEXT_DIR, { recursive: true, force: true });
    if (kept.length > 0) {
      console.warn(`no new clips downloaded; preserving ${kept.length} previously cached shorts`);
    } else {
      const previous = await readFile(MANIFEST, "utf8").then(JSON.parse).catch(() => []);
      if (previous.length > 0) console.warn(`no new clips downloaded; preserving ${previous.length} previously cached shorts`);
    }
  } else if (expired.length > 0 || finalManifest.length !== existing.length) {
    // no download pass: just tidy in place — drop expired clips, refresh manifest
    for (const item of expired) await rm(`public${item.src}`, { force: true }).catch(() => {});
    await writeFile(MANIFEST, `${JSON.stringify(finalManifest, null, 2)}\n`);
    console.log(`tidied the pool in place: ${finalManifest.length} shorts kept`);
  }

  await saveHistory(downloads, ranDownloadPass || due ? TODAY : lastRun);
}

try {
  await main();
} catch (e) {
  console.error("cache-shorts failed:", e.message);
  process.exitCode = 1;
}
