import { writeFile, readFile } from "node:fs/promises";

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

const channels = (await fetchChannels()).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));
const seen = new Set();
const videos = [];

for (const channel of channels) {
  try {
    const response = await fetch(channel.url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; GoaSocialBot/1.0)",
        accept: "text/html",
      },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    for (const videoId of uniqueVideoIds(html)) {
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
