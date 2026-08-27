/**
 * Adaptive quality brain for the shorts feed.
 *
 * Goal: the first 2-3 shorts ALWAYS start at the lowest tier so playback is
 * instant, then the app keeps measuring the real connection and silently
 * upgrades (or downgrades) quality. A tiny manual override lives in the feed.
 *
 * Probe schedule: 0s (cheap, from the Network Information API), then real
 * byte-timed probes at ~8s, ~25s, ~60s and every 60s after that. Cheap enough
 * to never compete with video bandwidth.
 */

export type QualityTier = "low" | "medium" | "high";
export type QualityMode = "auto" | QualityTier;

const MODE_KEY = "gs_quality_mode";
const TIER_KEY = "gs_quality_tier";
/** First N shorts are pinned to the lowest tier for an instant first frame. */
export const FAST_START_COUNT = 3;

type Listener = (tier: QualityTier, mode: QualityMode) => void;

const listeners = new Set<Listener>();
let mode: QualityMode = "auto";
let measured: QualityTier = "low";
let started = false;
let timer: number | undefined;

function readStored() {
  if (typeof window === "undefined") return;
  const storedMode = localStorage.getItem(MODE_KEY) as QualityMode | null;
  if (storedMode === "auto" || storedMode === "low" || storedMode === "medium" || storedMode === "high") {
    mode = storedMode;
  }
  const storedTier = sessionStorage.getItem(TIER_KEY) as QualityTier | null;
  if (storedTier === "low" || storedTier === "medium" || storedTier === "high") measured = storedTier;
}
readStored();

function emit() {
  const tier = currentTier();
  listeners.forEach((listener) => listener(tier, mode));
}

export function currentTier(): QualityTier {
  return mode === "auto" ? measured : mode;
}

export function currentMode(): QualityMode {
  return mode;
}

export function setQualityMode(next: QualityMode) {
  mode = next;
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {}
  emit();
}

export function onQualityChange(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyMeasured(next: QualityTier) {
  if (next === measured) return;
  measured = next;
  try {
    sessionStorage.setItem(TIER_KEY, next);
  } catch {}
  if (mode === "auto") emit();
}

function tierFromMbps(mbps: number): QualityTier {
  if (mbps >= 6) return "high";
  if (mbps >= 1.8) return "medium";
  return "low";
}

function hintedTier(): QualityTier | null {
  const connection = (navigator as any)?.connection;
  if (!connection) return null;
  if (connection.saveData) return "low";
  const effective = connection.effectiveType as string | undefined;
  if (effective === "slow-2g" || effective === "2g" || effective === "3g") return "low";
  const downlink = Number(connection.downlink);
  if (Number.isFinite(downlink) && downlink > 0) return tierFromMbps(downlink);
  return null;
}

/** Times a small real download to get honest throughput (not a vendor hint). */
async function probe(): Promise<QualityTier | null> {
  const url = `/cached-shorts.json?probe=${Date.now()}`;
  try {
    const start = performance.now();
    const response = await fetch(url, { cache: "no-store" });
    const buffer = await response.arrayBuffer();
    const seconds = (performance.now() - start) / 1000;
    if (seconds <= 0 || buffer.byteLength < 200) return null;
    // Small payload: latency dominates, so treat a slow round-trip as a slow link.
    const mbps = (buffer.byteLength * 8) / seconds / 1_000_000;
    if (seconds > 1.2) return "low";
    if (seconds < 0.18) return "high";
    return tierFromMbps(Math.max(mbps, seconds < 0.4 ? 6 : 2));
  } catch {
    return null;
  }
}

async function measureNow() {
  const hint = hintedTier();
  if (hint === "low") {
    applyMeasured("low");
    return;
  }
  const result = await probe();
  if (result) applyMeasured(result);
  else if (hint) applyMeasured(hint);
}

/** Starts the escalating measurement schedule (safe to call many times). */
export function startQualityWatch() {
  if (started || typeof window === "undefined") return;
  started = true;

  const hint = hintedTier();
  if (hint) applyMeasured(hint);

  const schedule = [8000, 25000, 60000];
  schedule.forEach((delay) => window.setTimeout(() => void measureNow(), delay));
  timer = window.setInterval(() => void measureNow(), 60000);

  (navigator as any)?.connection?.addEventListener?.("change", () => {
    const changed = hintedTier();
    if (changed) applyMeasured(changed);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void measureNow();
  });
}

export function stopQualityWatch() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
  started = false;
}

/** YouTube IFrame quality string for a tier. */
export function ytQuality(tier: QualityTier) {
  return tier === "high" ? "medium" : tier === "medium" ? "small" : "tiny";
}

/** How aggressively a native <video> should buffer at this tier. */
export function preloadFor(tier: QualityTier, index: number, isActive: boolean) {
  if (isActive) return "auto" as const;
  if (index < FAST_START_COUNT) return tier === "low" ? ("metadata" as const) : ("auto" as const);
  if (tier === "high") return "auto" as const;
  if (tier === "medium") return index <= FAST_START_COUNT + 1 ? ("metadata" as const) : ("none" as const);
  return "none" as const;
}

/** Poster resolution that matches the tier (saves bytes on slow links). */
export function posterFor(videoId: string, tier: QualityTier, index: number) {
  const size = index < FAST_START_COUNT || tier === "low" ? "mqdefault" : tier === "medium" ? "hqdefault" : "hq720";
  return `https://i.ytimg.com/vi/${videoId}/${size}.jpg`;
}
