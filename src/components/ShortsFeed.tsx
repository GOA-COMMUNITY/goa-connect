import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Heart, MessageCircle, Send, Volume2, VolumeX, Play, Settings2, Check } from "lucide-react";
import { toast } from "sonner";
import { recordLike, recordShare, recordWatch } from "@/lib/viewer-context";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCommentCounts,
  fetchLikeState,
  logShortEvent,
  setLike,
  shareUrlFor,
} from "@/lib/shorts-social";
import {
  FAST_START_COUNT,
  currentMode,
  currentTier,
  onQualityChange,
  posterFor,
  preloadFor,
  setQualityMode,
  startQualityWatch,
  ytQuality,
  type QualityMode,
  type QualityTier,
} from "@/lib/net-quality";
import { CommentSheet } from "@/components/CommentSheet";


export type Short = {
  videoId: string;
  channelName: string;
  channelIcon: string;
  /** Present for shorts on Goa Social's own hosting (instant playback). */
  src?: string;
  poster?: string;
  /** "upload" = permanent member upload, "youtube" = rotating daily pool. */
  source?: "youtube" | "upload";
  caption?: string;
  uploaderId?: string;
  createdAt?: string;
};


declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytReadyPromise?: Promise<any>;
    __gsShortsPlayers?: Map<string, any>;
  }
}

const SHORT_SOUND_KEY = "gs_shorts_sound";

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K` : `${value}`;

function loadYT(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.__ytReadyPromise) return window.__ytReadyPromise;

  window.__ytReadyPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const existing = document.querySelector<HTMLScriptElement>("script[src='https://www.youtube.com/iframe_api']");
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      resolve(window.YT);
    };
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return window.__ytReadyPromise;
}

function allPlayers() {
  if (!window.__gsShortsPlayers) window.__gsShortsPlayers = new Map<string, any>();
  return window.__gsShortsPlayers;
}

function applyQuality(player: any, tier: QualityTier) {
  const q = ytQuality(tier);
  try {
    player.setPlaybackQuality?.(q);
    player.setPlaybackQualityRange?.("tiny", q);
  } catch {}
}


function pauseEveryPlayerExcept(activeKey?: string) {
  if (typeof window === "undefined") return;
  allPlayers().forEach((player, key) => {
    if (key === activeKey) return;
    try {
      player.mute?.();
      player.pauseVideo?.();
    } catch {}
  });
}

export function ShortsFeed({ shorts }: { shorts: Short[] }) {
  const { user } = useAuth();
  const feedId = useRef(`feed-${Math.random().toString(36).slice(2)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const hostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nativeRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const players = useRef<Record<number, any>>({});

  const readyRef = useRef<Set<number>>(new Set());
  const activeIdxRef = useRef(0);
  const activeSinceRef = useRef(Date.now());
  const mutedRef = useRef(true);
  const visibleRatios = useRef<Record<number, number>>({});
  const lastTapRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1]));
  const [ready, setReady] = useState<Set<number>>(() => new Set());
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [burst, setBurst] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Short | null>(null);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(SHORT_SOUND_KEY) !== "on";
  });
  const [tier, setTier] = useState<QualityTier>(() => currentTier());
  const [qualityMode, setQualityModeState] = useState<QualityMode>(() => currentMode());
  const [qualityOpen, setQualityOpen] = useState(false);
  const tierRef = useRef<QualityTier>(tier);

  // Adaptive quality: start low, keep measuring the real connection, upgrade silently.
  useEffect(() => {
    startQualityWatch();
    const off = onQualityChange((nextTier, nextMode) => {
      tierRef.current = nextTier;
      setTier(nextTier);
      setQualityModeState(nextMode);
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);


  const videoIdsKey = useMemo(() => shorts.map((short) => short.videoId).join("|"), [shorts]);

  const sourceOf = useCallback(
    (short: Short) => short.source ?? (short.videoId.startsWith("u_") ? "upload" : "youtube"),
    [],
  );

  // Real engagement counts — a fresh short honestly starts at 0.
  useEffect(() => {
    let cancelled = false;
    const ids = shorts.map((short) => short.videoId);
    if (ids.length === 0) return;
    void Promise.all([fetchLikeState(ids, user?.id), fetchCommentCounts(ids)]).then(
      ([likes, comments]) => {
        if (cancelled) return;
        setLikeCounts(likes.counts);
        setLiked(likes.mine);
        setCommentCounts(comments);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [videoIdsKey, user?.id, shorts]);

  useEffect(() => {
    Object.entries(players.current).forEach(([rawIndex, player]) => {
      try { player.destroy?.(); } catch {}
      allPlayers().delete(`${feedId.current}:${rawIndex}`);
    });
    players.current = {};
    readyRef.current.clear();
    setReady(new Set());
    activeIdxRef.current = 0;
    setActiveIdx(0);
    setMounted(new Set([0, 1].filter((index) => index < shorts.length)));
  }, [videoIdsKey, shorts.length]);

  const frameStyle = useMemo(
    () => ({ minHeight: "clamp(560px, calc(100svh - 92px), 940px)" }),
    [],
  );


  const keepWarmAround = useCallback((center: number) => {
    setMounted((previous) => {
      const next = new Set<number>();
      for (let i = center - 1; i <= center + 1; i += 1) {
        if (i >= 0 && i < shorts.length) next.add(i);
      }
      let changed = next.size !== previous.size;
      if (!changed) next.forEach((i) => { if (!previous.has(i)) changed = true; });
      return changed ? next : previous;
    });
  }, [shorts.length]);


  const pauseLocal = useCallback(() => {
    Object.values(players.current).forEach((player) => {
      try {
        player.mute?.();
        player.pauseVideo?.();
      } catch {}
    });
    Object.values(nativeRefs.current).forEach((video) => {
      try {
        if (video && !video.paused) {
          video.muted = true;
          video.pause();
        }
      } catch {}
    });
  }, []);

  const syncPlayback = useCallback((index: number) => {
    const activeElement = itemRefs.current[index];
    if (activeElement) {
      const rect = activeElement.getBoundingClientRect();
      const screenCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const centeredEnough = Math.abs(elementCenter - screenCenter) < rect.height * 0.58;
      if (!centeredEnough) {
        pauseLocal();
        return;
      }
    }
    const activeKey = `${feedId.current}:${index}`;
    pauseEveryPlayerExcept(activeKey);
    Object.entries(players.current).forEach(([rawIndex, player]) => {
      const playerIndex = Number(rawIndex);
      try {
        applyQuality(player, playerIndex < FAST_START_COUNT ? "low" : tierRef.current);
        if (playerIndex === index) {
          if (mutedRef.current) player.mute?.();
          else player.unMute?.();
          player.playVideo?.();
        } else {
          player.mute?.();
          player.pauseVideo?.();
        }
      } catch {}
    });
    Object.entries(nativeRefs.current).forEach(([rawIndex, video]) => {
      if (!video) return;
      try {
        if (Number(rawIndex) === index) {
          video.muted = mutedRef.current;
          void video.play().catch(() => {});
        } else {
          video.muted = true;
          video.pause();
        }
      } catch {}
    });
  }, [pauseLocal]);


  const setActive = useCallback((index: number) => {
    if (index < 0 || index >= shorts.length) return;
    // feed brain: how long the previous short actually held attention
    const previous = activeIdxRef.current;
    if (previous !== index && shorts[previous]) {
      const watched = Date.now() - activeSinceRef.current;
      recordWatch(shorts[previous], watched);
      logShortEvent(
        shorts[previous].videoId,
        watched < 3000 ? "skip" : "watch",
        sourceOf(shorts[previous]),
        watched,
        user?.id,
      );
    }
    activeSinceRef.current = Date.now();
    activeIdxRef.current = index;
    setActiveIdx(index);
    setProgress(0);
    keepWarmAround(index);
    if (shorts[index]) logShortEvent(shorts[index].videoId, "view", sourceOf(shorts[index]), 0, user?.id);
    window.dispatchEvent(new CustomEvent("gs-shorts-active-feed", { detail: feedId.current }));
    syncPlayback(index);
  }, [keepWarmAround, shorts, sourceOf, syncPlayback, user?.id]);


  useEffect(() => {
    mutedRef.current = muted;
    syncPlayback(activeIdxRef.current);
  }, [muted, syncPlayback]);

  // Re-apply the newly measured quality tier to whatever is playing now.
  useEffect(() => {
    syncPlayback(activeIdxRef.current);
  }, [tier, syncPlayback]);


  useEffect(() => {
    const onSoundUnlocked = () => {
      mutedRef.current = false;
      setMuted(false);
      sessionStorage.setItem(SHORT_SOUND_KEY, "on");
      syncPlayback(activeIdxRef.current);
    };
    window.addEventListener("gs-enable-shorts-sound", onSoundUnlocked);
    return () => window.removeEventListener("gs-enable-shorts-sound", onSoundUnlocked);
  }, [syncPlayback]);

  useEffect(() => {
    const onOtherFeed = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== feedId.current) pauseLocal();
    };
    window.addEventListener("gs-shorts-active-feed", onOtherFeed);
    return () => window.removeEventListener("gs-shorts-active-feed", onOtherFeed);
  }, [pauseLocal]);

  useEffect(() => {
    if (shorts.length === 0) return;
    let raf = 0;
    const chooseMostVisible = () => {
      raf = 0;
      let bestIndex = activeIdxRef.current;
      let bestRatio = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      const viewportCenter = window.innerHeight / 2;
      Object.entries(visibleRatios.current).forEach(([rawIndex, ratio]) => {
        const index = Number(rawIndex);
        const element = itemRefs.current[index];
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
        if (ratio > 0.35 && (distance < bestDistance || (distance === bestDistance && ratio > bestRatio))) {
          bestRatio = ratio;
          bestDistance = distance;
          bestIndex = index;
        }
      });
      if (bestRatio >= 0.42 && bestDistance < window.innerHeight * 0.42 && bestIndex !== activeIdxRef.current) setActive(bestIndex);
      else if (bestRatio >= 0.42 && bestDistance < window.innerHeight * 0.42) syncPlayback(bestIndex);
      else pauseLocal();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = Number((entry.target as HTMLElement).dataset.shortIndex);
          visibleRatios.current[index] = entry.intersectionRatio;
        });
        if (!raf) raf = window.requestAnimationFrame(chooseMostVisible);
      },
      { threshold: [0, 0.35, 0.55, 0.72, 0.9] },
    );

    itemRefs.current.forEach((item) => item && observer.observe(item));
    keepWarmAround(activeIdxRef.current);
    syncPlayback(activeIdxRef.current);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [keepWarmAround, pauseLocal, setActive, shorts.length, syncPlayback]);

  useEffect(() => {
    if (shorts.length === 0) return;
    if (shorts.every((short) => short.src)) return;
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled) return;
      mounted.forEach((index) => {
        const short = shorts[index];
        const host = hostRefs.current[index];
        if (!short || short.src || !host || players.current[index]) return;

        players.current[index] = new YT.Player(host, {
          videoId: short.videoId,
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: index === activeIdxRef.current ? 1 : 0,
            mute: 1,
            controls: 0,
            loop: 1,
            playlist: short.videoId,
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            cc_load_policy: 0,
            showinfo: 0,
            enablejsapi: 1,
            vq: "tiny",
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              allPlayers().set(`${feedId.current}:${index}`, event.target);
              readyRef.current.add(index);
              setReady(new Set(readyRef.current));
              applyQuality(event.target, index < FAST_START_COUNT ? "low" : tierRef.current);
              event.target.mute?.();
              if (index !== activeIdxRef.current) event.target.pauseVideo?.();
              else syncPlayback(index);
            },
            onStateChange: (event: any) =>
              applyQuality(event.target, index < FAST_START_COUNT ? "low" : tierRef.current),

          },
        });
      });

      Object.keys(players.current).forEach((rawIndex) => {
        const index = Number(rawIndex);
        if (mounted.has(index)) return;
        try {
          players.current[index]?.mute?.();
          players.current[index]?.pauseVideo?.();
          players.current[index]?.destroy?.();
        } catch {}
        allPlayers().delete(`${feedId.current}:${index}`);
        delete players.current[index];
        readyRef.current.delete(index);
      });
      setReady(new Set(readyRef.current));
    });

    return () => {
      cancelled = true;
    };
  }, [mounted, videoIdsKey, syncPlayback]);

  useEffect(() => {
    return () => {
      Object.entries(players.current).forEach(([rawIndex, player]) => {
        try { player.destroy?.(); } catch {}
        allPlayers().delete(`${feedId.current}:${rawIndex}`);
      });
    };
  }, []);

  function enableSound() {
    mutedRef.current = false;
    setMuted(false);
    sessionStorage.setItem(SHORT_SOUND_KEY, "on");
    syncPlayback(activeIdxRef.current);
  }

  function toggleSound(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    sessionStorage.setItem(SHORT_SOUND_KEY, nextMuted ? "off" : "on");
    syncPlayback(activeIdxRef.current);
  }

  async function toggleLike(short: Short, force?: boolean) {
    const videoId = short.videoId;
    const nextLiked = force ?? !liked.has(videoId);
    if (nextLiked === liked.has(videoId)) return;
    setLiked((previous) => {
      const next = new Set(previous);
      if (nextLiked) next.add(videoId);
      else next.delete(videoId);
      return next;
    });
    setLikeCounts((previous) => ({
      ...previous,
      [videoId]: Math.max(0, (previous[videoId] ?? 0) + (nextLiked ? 1 : -1)),
    }));
    if (nextLiked) {
      setBurst(videoId);
      window.setTimeout(() => setBurst((current) => (current === videoId ? null : current)), 700);
      recordLike(short);
    }
    logShortEvent(videoId, nextLiked ? "like" : "unlike", sourceOf(short), 0, user?.id);
    if (!user) {
      toast.info("Sign in to save your likes");
      return;
    }
    try {
      await setLike(videoId, user.id, nextLiked);
    } catch {
      toast.error("Couldn't save that like");
    }
  }

  function onFrameTap(short: Short) {
    const now = Date.now();
    const last = lastTapRef.current;
    lastTapRef.current = { id: short.videoId, at: now };
    if (last.id === short.videoId && now - last.at < 320) {
      void toggleLike(short, true);
      return;
    }
    enableSound();
  }

  async function shareShort(short: Short) {
    recordShare(short);
    logShortEvent(short.videoId, "share", sourceOf(short), 0, user?.id);
    const url = shareUrlFor(short.videoId);
    const title = short.caption || `${short.channelName} on Goa Social`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Goa Social", text: title, url });
        return;
      }
    } catch {
      /* user dismissed the sheet */
    }
    try {
      await navigator.clipboard?.writeText(url);
      toast.success("Goa Social link copied");
    } catch {
      toast.info(url);
    }
  }

  if (shorts.length === 0) return null;

  return (
    <div ref={containerRef} data-shorts-feed={feedId.current} className="space-y-3">
      {shorts.map((short, index) => {
        const shouldMount = mounted.has(index);
        const isReady = ready.has(index);
        const isLiked = liked.has(short.videoId);
        const isActive = index === activeIdx;
        const isUpload = sourceOf(short) === "upload";
        return (
          <article
            key={`${short.videoId}-${index}`}
            ref={(element) => { itemRefs.current[index] = element; }}
            data-short-index={index}
            className="gs-short relative isolate flex w-full snap-start items-center justify-center overflow-hidden rounded-[1.6rem] border border-border bg-black shadow-card"
            style={{ ...frameStyle, contentVisibility: "auto", containIntrinsicSize: "700px" } as React.CSSProperties}
          >
            <img
              src={short.poster ?? posterFor(short.videoId, tier, index)}
              alt=""
              className={`absolute inset-0 h-full w-full scale-110 object-cover opacity-60 ${
                isActive ? "blur-xl" : "blur-md"
              }`}
              loading={index <= 2 ? "eager" : "lazy"}
              decoding="async"
              aria-hidden
            />
            {short.src ? (
              <video
                ref={(element) => {
                  nativeRefs.current[index] = element;
                  if (element) {
                    readyRef.current.add(index);
                  }
                }}
                src={short.src}
                poster={short.poster}
                className="absolute inset-0 h-full w-full object-cover"
                playsInline
                loop
                muted
                preload={preloadFor(tier, index, isActive)}

                onTimeUpdate={(event) => {
                  if (!isActive) return;
                  const el = event.currentTarget;
                  if (el.duration) setProgress(el.currentTime / el.duration);
                }}
                onEnded={() => logShortEvent(short.videoId, "complete", sourceOf(short), 0, user?.id)}
                onCanPlay={() => {
                  readyRef.current.add(index);
                  setReady(new Set(readyRef.current));
                  if (index === activeIdxRef.current) syncPlayback(index);
                }}
              />
            ) : (
              shouldMount && (
                <div className="absolute inset-0 overflow-hidden">
                  <div
                    ref={(element) => { hostRefs.current[index] = element; }}
                    className="absolute left-1/2 top-1/2 h-[124%] w-[124%] -translate-x-1/2 -translate-y-1/2 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
                  />
                </div>
              )
            )}


            {/* Goa Social header band — hides all source-player chrome */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/85 via-black/40 to-transparent px-4 pb-12 pt-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-base ring-1 ring-white/25">
                {short.channelIcon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{short.channelName}</p>
                <p className="text-[10px] uppercase tracking-[0.22em] opacity-70">
                  {isUpload ? "Goa Social original" : "Goa Social"}
                </p>
              </div>
              {isUpload && (
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
                  Local
                </span>
              )}
            </div>

            <button
              type="button"
              onPointerDown={() => onFrameTap(short)}
              className="absolute inset-0 z-10 cursor-default bg-transparent"
              aria-label="Play Goa Social short"
            />

            {burst === short.videoId && (
              <Heart className="gs-burst pointer-events-none absolute left-1/2 top-1/2 z-30 h-24 w-24 -translate-x-1/2 -translate-y-1/2 fill-red-500 text-red-500" />
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-4 pb-7 pt-28 text-white">
              <div className="min-w-0 max-w-[68%]">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1.5 backdrop-blur">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs">{short.channelIcon}</span>
                  <span className="truncate text-[11px] font-semibold">{short.channelName}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-snug">
                  {short.caption || "Goa, right now."}
                </p>
                <p className="mt-1 text-[11px] opacity-75">#goa #susegad #locals</p>
              </div>

              <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4 pb-1">
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); void toggleLike(short); }}
                  className="flex flex-col items-center gap-0.5 text-[11px] font-semibold"
                  aria-label={isLiked ? "Unlike short" : "Like short"}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-transform active:scale-90">
                    <Heart className={`h-6 w-6 ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                  </span>
                  <span>{compact(likeCounts[short.videoId] ?? 0)}</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); setOpenComments(short); }}
                  className="flex flex-col items-center gap-0.5 text-[11px] font-semibold"
                  aria-label="Open Goa Social comments"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-transform active:scale-90">
                    <MessageCircle className="h-6 w-6" />
                  </span>
                  <span>{compact(commentCounts[short.videoId] ?? 0)}</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); void shareShort(short); }}
                  className="flex flex-col items-center gap-0.5 text-[11px] font-semibold"
                  aria-label="Share on Goa Social"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur transition-transform active:scale-90">
                    <Send className="h-6 w-6" />
                  </span>
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                {isActive && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); setQualityOpen((open) => !open); }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white/70 backdrop-blur"
                      aria-label="Video quality"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    {qualityOpen && (
                      <div className="absolute bottom-9 right-0 z-40 w-40 overflow-hidden rounded-2xl border border-white/15 bg-black/85 text-left backdrop-blur">
                        <p className="px-3 pt-2 text-[9px] uppercase tracking-[0.2em] text-white/45">
                          Quality · {tier}
                        </p>
                        {([
                          ["auto", "Auto (smart)"],
                          ["low", "Data saver"],
                          ["medium", "Balanced"],
                          ["high", "Highest"],
                        ] as [QualityMode, string][]).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setQualityMode(value);
                              setQualityOpen(false);
                            }}
                            className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-medium text-white/90 active:bg-white/10"
                          >
                            {label}
                            {qualityMode === value && <Check className="h-3.5 w-3.5 text-emerald-300" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

            {/* playback progress hairline */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[3px] bg-white/10">
              <span
                className="block h-full bg-white/85 transition-[width] duration-200"
                style={{ width: `${isActive ? Math.round(progress * 100) : 0}%` }}
              />
            </div>

            {!isReady && (
              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/20 text-white">
                <Play className="h-8 w-8 animate-pulse opacity-70" />
              </div>
            )}
          </article>
        );
      })}

      {openComments && (
        <CommentSheet
          short={openComments}
          onClose={() => setOpenComments(null)}
          onCountChange={(videoId, count) => setCommentCounts((prev) => ({ ...prev, [videoId]: count }))}
        />
      )}

      <style>{`
        .gs-burst { animation: gsBurst 700ms cubic-bezier(.16,1,.3,1) forwards; }
        @keyframes gsBurst {
          0% { transform: translate(-50%,-50%) scale(.4); opacity:0 }
          25% { transform: translate(-50%,-50%) scale(1.15); opacity:1 }
          100% { transform: translate(-50%,-58%) scale(1); opacity:0 }
        }
      `}</style>
    </div>
  );
}
