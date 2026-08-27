import { writeFile, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const FALLBACK_CHANNELS = [
  { name: "Adventure Goa DK", url: "https://www.youtube.com/@adventuregoadk/shorts", icon: "🌴", priority: 1 },
  { name: "RDXGOA GOA NEWS", url: "https://www.youtube.com/@RDXGOA/shorts", icon: "🎥", priority: 2 },
];

// Load .env values so the GitHub Action doesn't need extra secrets configured.
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
    if (!r.ok) throw new Error(`${r.status}`);
    const rows = await r.json();
    return rows.length ? rows : FALLBACK_CHANNELS;
  } catch (e) {
    console.warn("Falling back to hardcoded channels:", e.message);
    return FALLBACK_CHANNELS;
  }
}

function uniqueVideoIds(html) {
  const ids = [];
  const patterns = [/"videoId":"([a-zA-Z0-9_-]{11})"/g, /\/shorts\/([a-zA-Z0-9_-]{11})/g];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) ids.push(match[1]);
  }
  return ids;
}

function shortsUrl(raw) {
  const clean = raw.trim().replace(/\/(videos|featured|streams|shorts)\/?$/, "");
  return `${clean}/shorts`;
}

async function idsFromYtDlp(channel) {
  try {
    const { stdout } = await run("yt-dlp", [
      "--flat-playlist", "--playlist-end", "30", "--no-warnings", "--ignore-config",
      "--retries", "3", "--socket-timeout", "20", "--js-runtimes", "deno",
      "--remote-components", "ejs:github",
      "--extractor-args", "youtube:player_client=web,web_safari,android_vr",
      "--print", "%(id)s", shortsUrl(channel.url),
    ], { maxBuffer: 10 * 1024 * 1024 });
    return stdout.split("\n").map((id) => id.trim()).filter((id) => /^[\w-]{11}$/.test(id));
  } catch (error) {
    console.warn(`yt-dlp listing failed for ${channel.name}:`, error.message.split("\n")[0]);
    return [];
  }
}

const channels = (await fetchChannels()).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
const seen = new Set();
const videos = [];

for (const channel of channels) {
  try {
    const extracted = await idsFromYtDlp(channel);
    const response = await fetch(channel.url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; GoaSocialBot/1.0)",
        accept: "text/html",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    for (const videoId of [...extracted, ...uniqueVideoIds(html)]) {
      if (seen.has(videoId)) continue;
      seen.add(videoId);
      videos.push({ videoId, channelName: channel.name, channelIcon: channel.icon ?? "🌴" });
      if (videos.length >= 80) break;
    }
  } catch (error) {
    console.warn(`Could not refresh ${channel.name}:`, error.message);
  }
  if (videos.length >= 80) break;
}

if (videos.length < 5) {
  throw new Error("YouTube refresh returned too few videos; keeping current file instead.");
}

await writeFile("public/videos.json", `${JSON.stringify(videos, null, 2)}\n`);
console.log(`Updated public/videos.json with ${videos.length} Shorts from ${channels.length} channels.`);
