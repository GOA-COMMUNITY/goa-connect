# Goa Social — YouTube Shorts download pipeline

This is the exact method Goa Social uses to pre-download YouTube Shorts onto its own
hosting so the feed starts instantly instead of waiting on YouTube.

Nothing runs in the browser. Everything happens inside a GitHub Actions runner during
deploy, and the finished `.mp4` files are shipped as static assets on GitHub Pages.

---

## 1. The moving parts

| Piece | Role |
| --- | --- |
| `yt-dlp` (nightly build) | lists a channel's newest Shorts and downloads them |
| `deno` | JS runtime yt-dlp uses to solve YouTube's player challenges |
| `ffmpeg` | re-encodes each clip to a tiny 360p file |
| `scripts/cache-shorts.mjs` | the orchestrator (quotas, retries, dedupe, atomic swap) |
| `.github/workflows/deploy.yml` | installs the tools, runs the script, caches the pool, deploys |
| `public/cached/*.mp4` | the downloaded clips |
| `public/cached-shorts.json` | manifest the site reads |
| `public/cached-history.json` | per-day list of already-pulled video IDs |

---

## 2. Step-by-step method

### Step A — read the channel list from the database
Channels are admin-managed rows in the `youtube_channels` table
(`name`, `url`, `icon`, `priority`, `weight`, `active`). The script fetches them over the
REST API with the publishable key. If the DB is unreachable it falls back to a hardcoded list.

### Step B — read the admin settings
The `app_settings` row with key `shorts` can disable caching entirely (`cachedFirst: false`)
or change the daily target (`maxCached`). Default target is **100 clips/day**.

### Step C — work out how many clips each channel owes
Every active channel is guaranteed at least its single latest Short. The remaining slots are
split proportionally to each channel's `weight`:

```js
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
```

So: few channels → many latest Shorts each. Many channels → one latest Short each.

### Step D — list the newest Shorts per channel
`yt-dlp --flat-playlist` on the channel's `/shorts` tab, newest first, with 3 attempts and a
different player-client/user-agent signature on each attempt:

```js
async function latestIdsFor(channel, limit) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const { stdout } = await run("yt-dlp", [
        "--flat-playlist",
        "--playlist-end", String(limit),
        ...ytArgs(attempt),
        "--print", "%(id)s",
        shortsUrl(channel.url),
      ], { maxBuffer: 20 * 1024 * 1024 });
      const ids = stdout.split("\n").map(s => s.trim()).filter(s => /^[\w-]{11}$/.test(s));
      if (ids.length > 0) return ids;
    } catch (e) {
      console.warn(`list attempt ${attempt}/3 failed for ${channel.name}:`, e.message.split("\n")[0]);
    }
  }
  return [];
}
```

It deliberately over-fetches (`quota + 40`, capped at 150) so gaps left by a failing channel
can be filled from another channel's 2nd/3rd/4th latest Short.

### Step E — interleave into one queue
Round-robin across channels so the cache is a mix rather than 40 clips from one creator:

```js
function interleave(lists, target) {
  const out = [];
  let i = 0, added = true;
  const cap = target * 3;
  while (added && out.length < cap) {
    added = false;
    for (const list of lists) {
      if (list.items[i]) { out.push({ videoId: list.items[i], channel: list.channel }); added = true; }
    }
    i += 1;
  }
  return out;
}
```

If channel listing fails completely, it falls back to IDs already in `public/videos.json`.

### Step F — download, rotating signatures
YouTube blocks a single client signature quickly, so each video is retried across four
different player-client + user-agent combinations:

```js
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
    "--no-warnings", "--ignore-config",
    "--retries", "5", "--fragment-retries", "5",
    "--socket-timeout", "20", "--sleep-requests", "1",
    "--js-runtimes", "deno",
    "--remote-components", "ejs:github",
    "--extractor-args", CLIENT_SETS[attempt % CLIENT_SETS.length],
    "--user-agent", UAS[attempt % UAS.length],
  ];
}

async function download(videoId) {
  const raw = `${NEXT_DIR}/${videoId}.src.%(ext)s`;
  let lastError;
  for (let attempt = 0; attempt < CLIENT_SETS.length; attempt += 1) {
    try {
      await run("yt-dlp", [
        "-f", "bv*[height<=480][ext=mp4]+ba[ext=m4a]/b[height<=480][ext=mp4]/b[ext=mp4]/b",
        ...ytArgs(attempt),
        "--no-playlist",
        "--max-filesize", "40M",
        "-o", raw,
        `https://www.youtube.com/watch?v=${videoId}`,
      ], { maxBuffer: 10 * 1024 * 1024 });
      return raw;
    } catch (e) { lastError = e; }
  }
  throw lastError ?? new Error("download failed");
}
```

Two details that matter a lot:
- `--js-runtimes deno` + `--remote-components ejs:github` let yt-dlp solve YouTube's
  signature challenges — without these most downloads 403.
- The format string caps source quality at 480p so the download is fast and small.

### Step G — compress with ffmpeg
Every clip is re-encoded to 360p H.264 baseline, mono 56 kbps AAC, first 60 seconds only,
with `+faststart` so playback begins before the file finishes buffering:

```js
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
```

Anything still larger than `MAX_BYTES` (2.2 MB) after compression is thrown away.

### Step H — parallel workers with claim-based dedupe
Four workers pull from the shared queue. A worker adds the ID to the history set *before*
downloading, so two workers can never grab the same video:

```js
const CONCURRENCY = Number(process.env.CACHE_CONCURRENCY || 4);

async function worker() {
  while (manifest.length < needed) {
    const item = queue[cursor++];
    if (!item) return;
    if (history.has(item.videoId)) continue;
    history.add(item.videoId);          // claim it
    // download -> compress -> size check -> push to manifest
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
```

### Step I — daily reset, never the same short twice in a day
`public/cached-history.json` stores `{ date: "YYYY-MM-DD", ids: [...] }`.
- If the stored date is today, the existing clips are kept and the run only *tops up* to 100.
- If it's a new UTC day, history is empty → full rebuild from the newest Shorts.
- A video ID already in today's history is never downloaded again that day. Tomorrow it's
  fair game again, so a channel that didn't upload anything new still contributes.

### Step J — atomic swap, old files deleted only after verification
Everything is built into `public/cached-next/`. Clips still valid from earlier today are copied
in, then every manifest entry is `stat`-ed on disk. Only entries that really exist get written
to the manifest, and only then is the old folder removed:

```js
await writeFile(NEXT_MANIFEST, `${JSON.stringify(verified, null, 2)}\n`);
await rm(OUT_DIR, { recursive: true, force: true });
await rename(NEXT_DIR, OUT_DIR);
await copyFile(NEXT_MANIFEST, MANIFEST);
await rm(NEXT_MANIFEST, { force: true });
await saveHistory(history);
```

If zero new clips download, the previous cache is preserved rather than wiped — the site never
ends up with an empty feed.

---

## 3. The GitHub Actions side

```yaml
- uses: denoland/setup-deno@v2
  with:
    deno-version: v2.x

- name: Install media tools
  run: |
    sudo apt-get update -qq
    sudo apt-get install -y -qq ffmpeg
    sudo curl --fail --retry 4 -sSL https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp

- name: Today's date (UTC)
  id: day
  run: echo "date=$(date -u +%F)" >> "$GITHUB_OUTPUT"

# Cache key rolls over daily -> the 100 shorts reset each day,
# while the 30-minute runs within a day just top the pool up.
- name: Restore today's shorts pool
  uses: actions/cache@v4
  with:
    path: |
      public/cached
      public/cached-shorts.json
      public/cached-history.json
    key: shorts-pool-${{ steps.day.outputs.date }}-${{ github.run_id }}
    restore-keys: |
      shorts-pool-${{ steps.day.outputs.date }}-

- name: Download / top up today's 100 latest shorts
  timeout-minutes: 120
  run: bun run shorts:cache
```

The workflow runs on push and on a `*/30 * * * *` cron, so the pool tops itself up every
30 minutes and fully resets each UTC day.

Key points: **nightly** yt-dlp (the stable release goes stale fast against YouTube changes),
`deno` installed before the script runs, and `actions/cache` keyed by date so a 30-minute run
doesn't re-download the 90 clips it already has.

---

## 4. How the site consumes it

`public/cached-shorts.json` is an array of:

```json
{
  "videoId": "abc123XYZ00",
  "src": "/cached/abc123XYZ00.mp4",
  "poster": "https://i.ytimg.com/vi/abc123XYZ00/hq720.jpg",
  "channelName": "Adventure Goa DK",
  "channelIcon": "🌴",
  "bytes": 796000
}
```

`ShortsFeed` reads the manifest and renders those entries as native `<video>` elements with
the poster as the placeholder — no YouTube iframe, no network round-trip to YouTube, so the
first frame appears essentially instantly. Only when the cached pool runs out (or the admin
has embeds enabled) does it fall back to a YouTube player.

---

## 5. Why each choice was made

- **Downloading instead of embedding** — an iframe needs several YouTube round-trips before
  the first frame; a 700 KB local MP4 starts in milliseconds.
- **360p / CRF 31 / 60s cap** — keeps 100 clips around 70–100 MB total, which stays inside
  static-hosting limits and loads fast on Goan mobile networks.
- **Rotating clients and user-agents** — a single signature gets rate-limited after ~10
  downloads; rotating four keeps a 100-clip run alive.
- **Claim-before-download** — the only safe way to run 4 parallel workers off one queue.
- **Build-to-temp then atomic swap** — a failed run can never leave the live site with a
  broken or empty video folder.

---

## 6. Legal note

Only download from channels you own or have explicit permission from. Goa Social's channel
list is admin-managed for exactly that reason — the operator confirms rights per channel
before adding it.
