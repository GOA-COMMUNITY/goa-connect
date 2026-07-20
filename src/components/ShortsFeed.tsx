import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Heart, Loader2, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

export type Short = {
  videoId: string;
  channelName: string;
  channelIcon: string;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytReadyPromise?: Promise<any>;
  }
}

function loadYT(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject();
  if (window.__ytReadyPromise) return window.__ytReadyPromise;
  window.__ytReadyPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
  });
  return window.__ytReadyPromise;
}

function requestLowQuality(player: any) {
  try {
    player.setPlaybackQuality?.("tiny");
    player.setPlaybackQualityRange?.("tiny", "small");
  } catch {}
}

function isFocusedFeed(root: HTMLDivElement | null) {
  if (!root || typeof document === "undefined") return false;
  const feeds = Array.from(document.querySelectorAll<HTMLDivElement>("[data-shorts-feed]"));
  const viewportCenter = window.innerHeight / 2;
  let best: HTMLDivElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  feeds.forEach((feed) => {
    const rect = feed.getBoundingClientRect();
    const visible = rect.bottom > 72 && rect.top < window.innerHeight - 72;
    if (!visible) return;
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - viewportCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = feed;
    }
  });
  return best === root;
}

export function ShortsFeed({ shorts }: { shorts: Short[] }) {
  const feedId = useRef(`feed-${Math.random().toString(36).slice(2)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerHostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const players = useRef<Record<number, any>>({});
  const readyPlayers = useRef<Set<number>>(new Set());
  const activeIdxRef = useRef(0);
  const mutedRef = useRef(true);
  const inViewportRef = useRef(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("gs_shorts_sound") !== "on";
  });
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1]));
  const [ready, setReady] = useState<Set<number>>(() => new Set());
  const [liked, setLiked] = useState<Set<number>>(() => new Set());
  const frameStyle = useMemo(() => ({ height: "clamp(430px, calc(100svh - 150px), 760px)" }), []);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const onSoundUnlocked = () => enableSound();
    window.addEventListener("gs-enable-shorts-sound", onSoundUnlocked);
    return () => window.removeEventListener("gs-enable-shorts-sound", onSoundUnlocked);
  }, []);

  const mountAround = useCallback((center: number) => {
    setMounted((prev) => {
      const next = new Set<number>();
      for (let d = -1; d <= 1; d++) {
        const i = center + d;
        if (i >= 0 && i < shorts.length) next.add(i);
      }
      // keep already-created first player alive for instant top replay
      if (shorts.length > 0) next.add(0);
      let changed = next.size !== prev.size;
      if (!changed) next.forEach((i) => { if (!prev.has(i)) changed = true; });
      return changed ? next : prev;
    });
  }, [shorts.length]);

  const pauseAll = useCallback(() => {
    Object.values(players.current).forEach((player) => {
      try {
        player.pauseVideo?.();
        player.mute?.();
      } catch {}
    });
  }, []);

  const syncPlayback = useCallback((index: number) => {
    if (!inViewportRef.current || !isFocusedFeed(containerRef.current)) {
      pauseAll();
      return;
    }
    window.dispatchEvent(new CustomEvent("gs-shorts-active-feed", { detail: feedId.current }));
    Object.entries(players.current).forEach(([key, player]) => {
      const i = Number(key);
      if (!player || typeof player.playVideo !== "function") return;
      try {
        requestLowQuality(player);
        if (i === index) {
          if (mutedRef.current) player.mute?.();
          else player.unMute?.();
          player.playVideo?.();
        } else {
          player.pauseVideo?.();
          player.mute?.();
        }
      } catch {}
    });
  }, [pauseAll]);

  useEffect(() => {
    const onOtherFeed = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== feedId.current) pauseAll();
    };
    window.addEventListener("gs-shorts-active-feed", onOtherFeed);
    return () => window.removeEventListener("gs-shorts-active-feed", onOtherFeed);
  }, [pauseAll]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        inViewportRef.current = visible;
        if (visible) syncPlayback(activeIdxRef.current);
        else pauseAll();
      },
      { threshold: [0, 0.2, 0.45, 0.75] }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [pauseAll, syncPlayback]);

  useEffect(() => {
    Object.keys(players.current).forEach((key) => {
      const i = Number(key);
      if (mounted.has(i)) return;
      try {
        players.current[i]?.pauseVideo?.();
        players.current[i]?.mute?.();
        players.current[i]?.destroy?.();
      } catch {}
      delete players.current[i];
      readyPlayers.current.delete(i);
      setReady(new Set(readyPlayers.current));
    });

    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled) return;
      mounted.forEach((i) => {
        const short = shorts[i];
        if (!short || players.current[i] || !playerHostRefs.current[i]) return;
        players.current[i] = new YT.Player(playerHostRefs.current[i]!, {
          videoId: short.videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: i === activeIdxRef.current && inViewportRef.current ? 1 : 0,
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
            vq: "tiny",
            origin: window.location.origin,
          },
          events: {
            onReady: (e: any) => {
              readyPlayers.current.add(i);
              setReady(new Set(readyPlayers.current));
              requestLowQuality(e.target);
              e.target.mute?.();
              if (i === activeIdxRef.current && inViewportRef.current) syncPlayback(i);
            },
            onStateChange: (e: any) => requestLowQuality(e.target),
          },
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, shorts, syncPlayback]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let raf = 0;
    const detect = () => {
      raf = 0;
      const rootRect = root.getBoundingClientRect();
      const center = rootRect.top + rootRect.height / 2;
      let best = activeIdxRef.current;
      let bestDistance = Number.POSITIVE_INFINITY;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= rootRect.top || rect.top >= rootRect.bottom) return;
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      if (best !== activeIdxRef.current) {
        players.current[activeIdxRef.current]?.pauseVideo?.();
        players.current[activeIdxRef.current]?.mute?.();
        activeIdxRef.current = best;
        setActiveIdx(best);
        mountAround(best);
        syncPlayback(best);
      }
    };
    const onScroll = () => {
      pauseAll();
      if (!raf) raf = window.requestAnimationFrame(detect);
    };
    detect();
    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("scrollend", detect);
    window.addEventListener("resize", detect);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("gs-shorts-recheck", detect);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("scrollend", detect);
      window.removeEventListener("resize", detect);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("gs-shorts-recheck", detect);
    };
  }, [mountAround, pauseAll, syncPlayback]);

  useEffect(() => {
    mountAround(activeIdx);
    syncPlayback(activeIdx);
  }, [activeIdx, mountAround, syncPlayback]);

  useEffect(() => {
    mutedRef.current = muted;
    syncPlayback(activeIdxRef.current);
  }, [muted, syncPlayback]);

  function enableSound() {
    sessionStorage.setItem("gs_shorts_sound", "on");
    mutedRef.current = false;
    setMuted(false);
    const active = players.current[activeIdxRef.current];
    try {
      active?.unMute?.();
      active?.playVideo?.();
    } catch {}
  }

  function toggleSound() {
    const next = !mutedRef.current;
    sessionStorage.setItem("gs_shorts_sound", next ? "off" : "on");
    mutedRef.current = next;
    setMuted(next);
  }

  function handleFeedClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button,a")) return;
    enableSound();
  }

  function toggleLike(index: number) {
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (shorts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      data-shorts-feed={feedId.current}
      onPointerDown={enableSound}
      onClick={handleFeedClick}
      className="relative snap-y snap-mandatory overflow-y-auto rounded-[1.45rem] border border-border bg-black shadow-card scrollbar-hide overscroll-contain"
      style={frameStyle}
    >
      <button
        onClick={toggleSound}
        className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {shorts.map((s, i) => {
        const shouldMount = mounted.has(i);
        return (
          <div
            key={s.videoId + i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="snap-start relative flex w-full items-center justify-center overflow-hidden bg-black"
            style={frameStyle}
          >
            <img
              src={`https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover blur-[1px] scale-105 opacity-75"
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            {shouldMount && (
              <div
                ref={(el) => {
                  playerHostRefs.current[i] = el;
                }}
                className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
              />
            )}

            {i === activeIdx && !ready.has(i) && (
              <div className="absolute inset-0 z-[5] flex items-center justify-center bg-black/20 text-white">
                <div className="flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold backdrop-blur">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading short
                </div>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-7 pt-24 text-white">
              <div className="pointer-events-auto min-w-0 max-w-[68%]">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-base backdrop-blur">
                    {s.channelIcon}
                  </div>
                  <p className="truncate text-sm font-semibold drop-shadow">{s.channelName}</p>
                </div>
                <p className="mt-2 text-xs opacity-90">#goa #susegad</p>
              </div>
              <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4 pb-1">
                <button
                  onClick={() => toggleLike(i)}
                  className="flex flex-col items-center text-xs font-semibold"
                  aria-label={liked.has(i) ? "Unlike short" : "Like short"}
                >
                  <Heart className={`h-7 w-7 drop-shadow ${liked.has(i) ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{((i * 7 + 12) % 90) + 10}k</span>
                </button>
                <button
                  onClick={() => toast.info("Comments are coming soon")}
                  className="flex flex-col items-center text-xs font-semibold"
                  aria-label="Open comments"
                >
                  <MessageCircle className="h-7 w-7 drop-shadow" />
                  <span>{((i * 3 + 5) % 50) + 5}</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    toast.success("Link copied");
                  }}
                  className="flex flex-col items-center text-xs font-semibold"
                  aria-label="Share short"
                >
                  <Share2 className="h-7 w-7 drop-shadow" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}