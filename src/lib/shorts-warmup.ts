/**
 * Shorts warm-up: runs the moment the splash screen appears so the first
 * short is fully buffered (and the video list is cached) before the user
 * ever sees the feed.
 *
 * We do NOT re-host YouTube videos. Instead we pay every network cost
 * up-front, behind the splash animation:
 *  - preconnect / DNS to every YouTube + CDN origin
 *  - load the IFrame API script early
 *  - warm hidden muted players for the first shorts so their video segments
 *    are already in the browser cache when the real player mounts
 *  - cache videos.json in sessionStorage for instant repeat loads
 */

export type WarmShort = { videoId: string; channelName: string; channelIcon: string };

const LIST_CACHE_KEY = "gs_videos_cache_v1";
const LIST_CACHE_TTL = 15 * 60 * 1000;

const ORIGINS = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
  "https://i.ytimg.com",
  "https://s.ytimg.com",
  "https://yt3.ggpht.com",
  "https://googlevideo.com",
  "https://rr1---sn-cvh7knzk.googlevideo.com",
];

let warmed = false;

function addLink(rel: string, href: string, extra: Partial<HTMLLinkElement> = {}) {
  if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  Object.assign(link, extra);
  document.head.appendChild(link);
}

function warmOrigins() {
  ORIGINS.forEach((origin) => {
    addLink("preconnect", origin, { crossOrigin: "anonymous" } as Partial<HTMLLinkElement>);
    addLink("dns-prefetch", origin);
  });
}

function loadIframeApi() {
  if (document.querySelector("script[src='https://www.youtube.com/iframe_api']")) return;
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.async = true;
  document.head.appendChild(script);
}

/** Hidden, muted, off-screen players that force YouTube to buffer the video. */
function bufferShorts(ids: string[]) {
  if (ids.length === 0) return;
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden";
  document.body.appendChild(host);

  ids.forEach((videoId, index) => {
    window.setTimeout(() => {
      const frame = document.createElement("iframe");
      frame.allow = "autoplay; encrypted-media";
      frame.src =
        `https://www.youtube-nocookie.com/embed/${videoId}` +
        `?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1&vq=tiny&origin=${encodeURIComponent(
          window.location.origin,
        )}`;
      frame.width = "1";
      frame.height = "1";
      host.appendChild(frame);
    }, index * 400);
  });

  // Keep buffering only while the splash is on screen, then release memory.
  const cleanup = () => {
    host.remove();
    window.removeEventListener("gs-shorts-warm-done", cleanup);
  };
  window.addEventListener("gs-shorts-warm-done", cleanup);
  window.setTimeout(cleanup, 9000);
}

function warmThumbnails(ids: string[]) {
  ids.forEach((videoId, index) => {
    const image = new Image();
    image.decoding = "async";
    if (index > 0) image.loading = "lazy";
    image.src = `https://i.ytimg.com/vi/${videoId}/hq720.jpg`;
  });
}

/** Instantly available cached list (used before the network responds). */
export function getCachedShorts(): WarmShort[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; items: WarmShort[] };
    if (!parsed?.items?.length) return null;
    if (Date.now() - parsed.at > LIST_CACHE_TTL) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function cacheShorts(items: WarmShort[]) {
  try {
    sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {}
}

/**
 * Kick off everything. Returns the freshest list of shorts it could get
 * (cached first, network second) so callers can render instantly.
 */
export async function warmShorts(
  fallback: WarmShort[],
  onList?: (items: WarmShort[]) => void,
): Promise<void> {
  if (typeof window === "undefined") return;

  const cached = getCachedShorts();
  const seed = cached?.length ? cached : fallback;

  if (!warmed) {
    warmed = true;
    warmOrigins();
    loadIframeApi();
    warmThumbnails(seed.slice(0, 4).map((short) => short.videoId));
    bufferShorts(seed.slice(0, 2).map((short) => short.videoId));
  }

  if (cached?.length) onList?.(cached);

  try {
    const response = await fetch(`/videos.json?v=${Math.floor(Date.now() / 900000)}`, {
      cache: "no-store",
    });
    const items = (await response.json()) as WarmShort[];
    if (Array.isArray(items) && items.length) {
      const trimmed = items.slice(0, 36);
      cacheShorts(trimmed);
      warmThumbnails(trimmed.slice(0, 4).map((short) => short.videoId));
      onList?.(trimmed);
    }
  } catch {}
}

/** Called when the splash finishes so hidden warm-up frames are dropped. */
export function releaseWarmup() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("gs-shorts-warm-done"));
}
