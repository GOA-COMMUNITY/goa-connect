/**
 * Mini per-user context ("your feed brain").
 *
 * Everything lives in the browser only, is tiny, and self-expires, so it
 * costs no storage on our side and stays private:
 *   - per-channel affinity built from watch time, likes, shares and skips
 *   - the videoIds already seen recently, so the same clip isn't repeated
 *   - entries older than CONTEXT_TTL_DAYS are dropped automatically
 *
 * The ranking keeps the feed fresh (latest-first bias) while gently moving
 * the channels a viewer actually watches towards the top, and always leaves
 * exploration slots so a new channel can still break through.
 */

export type Short = { videoId: string; channelName: string; channelIcon: string; src?: string; poster?: string };

const KEY = "gs_viewer_context_v1";
export const CONTEXT_TTL_DAYS = 14;
const SEEN_TTL_DAYS = 3;

type ChannelStat = { score: number; watchMs: number; likes: number; skips: number; updated: number };
type Context = {
  channels: Record<string, ChannelStat>;
  seen: Record<string, number>;
  updated: number;
};

const empty = (): Context => ({ channels: {}, seen: {}, updated: Date.now() });

function prune(context: Context): Context {
  const now = Date.now();
  const channelCutoff = now - CONTEXT_TTL_DAYS * 86_400_000;
  const seenCutoff = now - SEEN_TTL_DAYS * 86_400_000;
  for (const [name, stat] of Object.entries(context.channels)) {
    if (stat.updated < channelCutoff) delete context.channels[name];
  }
  for (const [id, at] of Object.entries(context.seen)) {
    if (at < seenCutoff) delete context.seen[id];
  }
  return context;
}

export function readContext(): Context {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Context;
    if (!parsed?.channels) return empty();
    return prune(parsed);
  } catch {
    return empty();
  }
}

function write(context: Context) {
  if (typeof window === "undefined") return;
  context.updated = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(prune(context)));
  } catch {}
}

function bump(channelName: string, delta: number, patch: Partial<ChannelStat> = {}) {
  const context = readContext();
  const stat = context.channels[channelName] ?? { score: 0, watchMs: 0, likes: 0, skips: 0, updated: Date.now() };
  context.channels[channelName] = {
    score: Math.max(-20, Math.min(60, stat.score + delta)),
    watchMs: stat.watchMs + (patch.watchMs ?? 0),
    likes: stat.likes + (patch.likes ?? 0),
    skips: stat.skips + (patch.skips ?? 0),
    updated: Date.now(),
  };
  write(context);
}

/** Called when a short leaves the screen — how long it was actually watched. */
export function recordWatch(short: Short, ms: number) {
  if (!short?.channelName) return;
  const context = readContext();
  context.seen[short.videoId] = Date.now();
  write(context);
  if (ms >= 12_000) bump(short.channelName, 3, { watchMs: ms });
  else if (ms >= 5_000) bump(short.channelName, 1, { watchMs: ms });
  else if (ms > 0) bump(short.channelName, -1, { skips: 1 });
}

export function recordLike(short: Short) {
  if (short?.channelName) bump(short.channelName, 6, { likes: 1 });
}

export function recordShare(short: Short) {
  if (short?.channelName) bump(short.channelName, 4);
}

export function clearContext() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

/** Human-readable summary for the "your feed" panel. */
export function contextSummary() {
  const context = readContext();
  const channels = Object.entries(context.channels)
    .map(([name, stat]) => ({ name, ...stat }))
    .sort((a, b) => b.score - a.score);
  const totalMinutes = Math.round(channels.reduce((sum, c) => sum + c.watchMs, 0) / 60_000);
  return { channels, totalMinutes, seenCount: Object.keys(context.seen).length, expiresInDays: CONTEXT_TTL_DAYS };
}

/**
 * Personalised ordering of the daily downloaded pool.
 *  - the very first clip stays the newest one (instant, predictable hook)
 *  - after that, clips are scored by channel affinity + freshness
 *  - every 4th slot is an exploration slot (untouched original order)
 *  - recently seen clips sink to the bottom instead of disappearing
 */
export function rankShorts(shorts: Short[]): Short[] {
  if (typeof window === "undefined" || shorts.length < 4) return shorts;
  const context = readContext();
  const hasSignal = Object.keys(context.channels).length > 0;
  if (!hasSignal) return shorts;

  const [head, ...rest] = shorts;
  const scored = rest.map((short, index) => {
    const stat = context.channels[short.channelName];
    const affinity = stat ? stat.score : 0;
    const freshness = (rest.length - index) / rest.length * 8; // newest first bias
    const seenPenalty = context.seen[short.videoId] ? -25 : 0;
    return { short, index, score: affinity + freshness + seenPenalty };
  });

  const byScore = [...scored].sort((a, b) => b.score - a.score || a.index - b.index);
  const explore = [...scored].sort((a, b) => a.index - b.index);

  const out: Short[] = [head];
  const used = new Set<string>([head.videoId]);
  let scoreCursor = 0;
  let exploreCursor = 0;

  while (out.length < shorts.length) {
    const useExplore = out.length % 4 === 0;
    const pool = useExplore ? explore : byScore;
    let cursor = useExplore ? exploreCursor : scoreCursor;
    while (cursor < pool.length && used.has(pool[cursor].short.videoId)) cursor += 1;
    if (cursor >= pool.length) {
      const leftover = scored.find((entry) => !used.has(entry.short.videoId));
      if (!leftover) break;
      used.add(leftover.short.videoId);
      out.push(leftover.short);
      continue;
    }
    used.add(pool[cursor].short.videoId);
    out.push(pool[cursor].short);
    if (useExplore) exploreCursor = cursor + 1;
    else scoreCursor = cursor + 1;
  }

  return out;
}
