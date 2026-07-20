import { writeFile } from "node:fs/promises";

const channels = [
  { name: "Adventure Goa DK", url: "https://www.youtube.com/@adventuregoadk/shorts", icon: "🌴", priority: 1 },
  { name: "RDXGOA GOA NEWS", url: "https://www.youtube.com/@RDXGOA/shorts", icon: "🎥", priority: 2 },
];

function uniqueVideoIds(html) {
  const ids = [];
  const patterns = [/"videoId":"([a-zA-Z0-9_-]{11})"/g, /\/shorts\/([a-zA-Z0-9_-]{11})/g];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) ids.push(match[1]);
  }
  return ids;
}

const seen = new Set();
const videos = [];

for (const channel of channels.sort((a, b) => a.priority - b.priority)) {
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
      videos.push({ videoId, channelName: channel.name, channelIcon: channel.icon });
      if (videos.length >= 60) break;
    }
  } catch (error) {
    console.warn(`Could not refresh ${channel.name}:`, error.message);
  }
}

if (videos.length < 5) {
  throw new Error("YouTube refresh returned too few videos; keeping current file instead.");
}

await writeFile("public/videos.json", `${JSON.stringify(videos, null, 2)}\n`);
console.log(`Updated public/videos.json with ${videos.length} Shorts.`);