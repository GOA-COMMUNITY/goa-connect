import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Heart, Loader2, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";

export type Short = {
  videoId: string;
  channelName: string;
  channelIcon: string;
};

// Lazy-load YouTube IFrame API once
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
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
  });
  return window.__ytReadyPromise;
}

/**
 * Vertical snap-scroll shorts feed.
 * - iframes mount once, controlled via YT IFrame API (never remount)
 * - preload ±2 window, first 3 mounted eagerly
 * - starts muted for autoplay; tap unmutes globally
 */
export function ShortsFeed({ shorts }: { shorts: Short[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playerHostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const players = useRef<Record<number, any>>({});
  const readyPlayers = useRef<Set<number>>(new Set());
  const warmedPlayers = useRef<Set<number>>(new Set());
  const activeIdxRef = useRef(0);
  const mutedRef = useRef(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("gs_shorts_sound") !== "on";
  });
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const [ready, setReady] = useState<Set<number>>(() => new Set());
  const [liked, setLiked] = useState<Set<number>>(() => new Set());
  const frameStyle = useMemo(() => ({ height: "clamp(420px, calc(100dvh - 158px), 760px)" }), []);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const mountAround = useCallback((center: number) => {
    setMounted((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (let d = -3; d <= 3; d++) {
        const i = center + d;
        if (i >= 0 && i < shorts.length && !next.has(i)) {
          next.add(i);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [shorts.length]);

  const warmPlayer = useCallback((index: number) => {
    const player = players.current[index];
    if (!player || warmedPlayers.current.has(index)) return;
    warmedPlayers.current.add(index);
    try {
      player.mute?.();
      player.playVideo?.();
      window.setTimeout(() => {
        if (activeIdxRef.current !== index) player.pauseVideo?.();
        if (!mutedRef.current) player.unMute?.();
      }, 900);
    } catch {}
  }, []);

  const syncPlayback = useCallback((index: number) => {
    Object.entries(players.current).forEach(([key, player]) => {
      const i = Number(key);
      if (!player || typeof player.playVideo !== "function") return;
      try {
        if (Math.abs(i - index) > 3) {
          player.pauseVideo();
          return;
        }
        if (i === index) {
          if (mutedRef.current) player.mute?.();
          else player.unMute?.();
          player.playVideo();
        } else if (Math.abs(i - index) <= 2) {
          warmPlayer(i);
        } else {
          player.pauseVideo?.();
        }
      } catch {}
    });
  }, [warmPlayer]);

  // Instantiate a YT player for each mounted index
  useEffect(() => {
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
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: i === activeIdx ? 1 : 0,
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
          },
          events: {
            onReady: (e: any) => {
              readyPlayers.current.add(i);
              setReady(new Set(readyPlayers.current));
              if (mutedRef.current) e.target.mute();
              else e.target.unMute();
              if (i === activeIdxRef.current) e.target.playVideo();
              else warmPlayer(i);
            },
            onStateChange: () => setReady(new Set(readyPlayers.current)),
          },
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, shorts, activeIdx, warmPlayer]);

  // Pick the slide closest to the frame center. This is more reliable than only
  // trusting IntersectionObserver entries during fast up/down snap scrolling.
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
        const visible = rect.bottom > rootRect.top && rect.top < rootRect.bottom;
        if (!visible) return;
        const distance = Math.abs(rect.top + rect.height / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      if (best !== activeIdxRef.current) {
        activeIdxRef.current = best;
        setActiveIdx(best);
        mountAround(best);
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(detect);
    };
    detect();
    root.addEventListener("scroll", onScroll, { passive: true });
    root.addEventListener("scrollend", onScroll);
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      root.removeEventListener("scroll", onScroll);
      root.removeEventListener("scrollend", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [mountAround]);

  // Play/pause on active change
  useEffect(() => {
    mountAround(activeIdx);
    syncPlayback(activeIdx);
  }, [activeIdx, mounted, mountAround, syncPlayback]);

  // Mute state sync
  useEffect(() => {
    Object.values(players.current).forEach((p: any) => {
      if (!p) return;
      try {
        if (muted) p.mute?.();
        else p.unMute?.();
      } catch {}
    });
  }, [muted]);

  function enableSound() {
    if (!muted) return;
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
    setMuted((current) => {
      const next = !current;
      mutedRef.current = next;
      sessionStorage.setItem("gs_shorts_sound", next ? "off" : "on");
      const active = players.current[activeIdxRef.current];
      try {
        if (next) active?.mute?.();
        else {
          active?.unMute?.();
          active?.playVideo?.();
        }
      } catch {}
      return next;
    });
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
      onClick={handleFeedClick}
      className="relative snap-y snap-mandatory overflow-y-auto rounded-[1.7rem] border border-border bg-black shadow-card scrollbar-hide"
      style={frameStyle}
    >
      {/* Sound toggle */}
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
            data-idx={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="snap-start relative w-full bg-black flex items-center justify-center overflow-hidden"
            style={frameStyle}
          >
            {/* Thumbnail beneath — instant paint */}
            <img
              src={`https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
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

            {/* Tap-to-unmute hint on first short while muted */}
            {muted && i === activeIdx && (
              <button
                onClick={enableSound}
                className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-white/92 px-4 py-1.5 text-xs font-semibold text-black shadow-lg"
              >
                Tap anywhere for sound
              </button>
            )}

            {/* Overlay UI */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-4 pb-7 pt-24 text-white">
              <div className="pointer-events-auto min-w-0 max-w-[68%]">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur text-base">
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
