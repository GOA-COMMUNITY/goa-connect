import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Heart, MessageCircle, Send, Volume2, VolumeX } from "lucide-react";
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
    __gsShortsPlayers?: Map<string, any>;
  }
}

const SHORT_SOUND_KEY = "gs_shorts_sound";

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

function setTinyQuality(player: any) {
  try {
    player.setPlaybackQuality?.("tiny");
    player.setPlaybackQualityRange?.("tiny", "small");
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
  const feedId = useRef(`feed-${Math.random().toString(36).slice(2)}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const hostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const players = useRef<Record<number, any>>({});
  const readyRef = useRef<Set<number>>(new Set());
  const activeIdxRef = useRef(0);
  const mutedRef = useRef(true);
  const visibleRatios = useRef<Record<number, number>>({});
  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1, 2]));
  const [ready, setReady] = useState<Set<number>>(() => new Set());
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem(SHORT_SOUND_KEY) !== "on";
  });

  const frameStyle = useMemo(
    () => ({ minHeight: "clamp(440px, calc(100svh - 152px), 760px)" }),
    [],
  );

  const keepWarmAround = useCallback((center: number) => {
    setMounted((previous) => {
      const next = new Set<number>();
      for (let i = center - 2; i <= center + 3; i += 1) {
        if (i >= 0 && i < shorts.length) next.add(i);
      }
      if (shorts.length > 0) next.add(0);
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
  }, []);

  const syncPlayback = useCallback((index: number) => {
    const activeKey = `${feedId.current}:${index}`;
    pauseEveryPlayerExcept(activeKey);
    Object.entries(players.current).forEach(([rawIndex, player]) => {
      const playerIndex = Number(rawIndex);
      try {
        setTinyQuality(player);
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
  }, []);

  const setActive = useCallback((index: number) => {
    if (index < 0 || index >= shorts.length) return;
    activeIdxRef.current = index;
    setActiveIdx(index);
    keepWarmAround(index);
    window.dispatchEvent(new CustomEvent("gs-shorts-active-feed", { detail: feedId.current }));
    syncPlayback(index);
  }, [keepWarmAround, shorts.length, syncPlayback]);

  useEffect(() => {
    mutedRef.current = muted;
    syncPlayback(activeIdxRef.current);
  }, [muted, syncPlayback]);

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
      Object.entries(visibleRatios.current).forEach(([rawIndex, ratio]) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestIndex = Number(rawIndex);
        }
      });
      if (bestRatio >= 0.55 && bestIndex !== activeIdxRef.current) setActive(bestIndex);
      else if (bestRatio >= 0.55) syncPlayback(bestIndex);
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
  }, [keepWarmAround, setActive, shorts.length, syncPlayback]);

  useEffect(() => {
    if (shorts.length === 0) return;
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled) return;
      mounted.forEach((index) => {
        const short = shorts[index];
        const host = hostRefs.current[index];
        if (!short || !host || players.current[index]) return;
        players.current[index] = new YT.Player(host, {
          videoId: short.videoId,
          width: "100%",
          height: "100%",
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
            vq: "tiny",
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              allPlayers().set(`${feedId.current}:${index}`, event.target);
              readyRef.current.add(index);
              setReady(new Set(readyRef.current));
              setTinyQuality(event.target);
              event.target.mute?.();
              if (index !== activeIdxRef.current) event.target.pauseVideo?.();
              else syncPlayback(index);
            },
            onStateChange: (event: any) => setTinyQuality(event.target),
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
  }, [mounted, shorts, syncPlayback]);

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

  function toggleLike(videoId: string) {
    setLiked((previous) => {
      const next = new Set(previous);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }

  function shareShort(videoId: string) {
    const url = `${window.location.origin}/?short=${encodeURIComponent(videoId)}`;
    navigator.clipboard?.writeText(url);
    toast.success("Goa Social short link copied");
  }

  if (shorts.length === 0) return null;

  return (
    <div ref={containerRef} data-shorts-feed={feedId.current} className="space-y-3">
      {shorts.map((short, index) => {
        const shouldMount = mounted.has(index);
        const isReady = ready.has(index);
        const isLiked = liked.has(short.videoId);
        return (
          <article
            key={`${short.videoId}-${index}`}
            ref={(element) => { itemRefs.current[index] = element; }}
            data-short-index={index}
            className="relative isolate flex w-full snap-start items-center justify-center overflow-hidden rounded-[1.35rem] border border-border bg-black shadow-card"
            style={frameStyle}
          >
            <img
              src={`https://i.ytimg.com/vi/${short.videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full scale-105 object-cover opacity-80 blur-[1px]"
              loading={index <= 2 ? "eager" : "lazy"}
              decoding="async"
            />
            {shouldMount && (
              <div
                ref={(element) => { hostRefs.current[index] = element; }}
                className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0"
              />
            )}

            <button
              type="button"
              onPointerDown={enableSound}
              onClick={enableSound}
              className="absolute inset-0 z-10 cursor-default bg-transparent"
              aria-label="Play Goa Social short"
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/90 via-black/30 to-transparent px-4 pb-6 pt-28 text-white">
              <div className="min-w-0 max-w-[68%]">
                <div className="inline-flex items-center gap-2 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-md">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-sm">{short.channelIcon}</span>
                  <span className="truncate text-xs font-semibold">Goa Social Short</span>
                </div>
                <p className="mt-2 text-xs font-medium opacity-90">#goa #susegad #locals</p>
              </div>

              <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4 pb-1">
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); toggleLike(short.videoId); }}
                  className="flex flex-col items-center text-xs font-semibold"
                  aria-label={isLiked ? "Unlike short" : "Like short"}
                >
                  <Heart className={`h-7 w-7 drop-shadow ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
                  <span>{((index * 7 + 12) % 90) + 10}k</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); toast.info("Goa Social comments are coming soon"); }}
                  className="flex flex-col items-center text-xs font-semibold"
                  aria-label="Open Goa Social comments"
                >
                  <MessageCircle className="h-7 w-7 drop-shadow" />
                  <span>{((index * 3 + 5) % 50) + 5}</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); shareShort(short.videoId); }}
                  className="flex flex-col items-center text-xs font-semibold"
                  aria-label="Share Goa Social short"
                >
                  <Send className="h-7 w-7 drop-shadow" />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={toggleSound}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur"
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isReady && (
              <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center bg-black/10 text-white">
                <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}