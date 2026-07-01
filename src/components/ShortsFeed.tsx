import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Volume2, VolumeX } from "lucide-react";

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
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1, 2]));

  // Instantiate a YT player for each mounted index
  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled) return;
      mounted.forEach((i) => {
        if (players.current[i] || !playerHostRefs.current[i]) return;
        players.current[i] = new YT.Player(playerHostRefs.current[i]!, {
          videoId: shorts[i].videoId,
          playerVars: {
            autoplay: i === activeIdx ? 1 : 0,
            mute: 1,
            controls: 0,
            loop: 1,
            playlist: shorts[i].videoId,
            playsinline: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (e: any) => {
              if (muted) e.target.mute();
              else e.target.unMute();
              if (i === activeIdx) e.target.playVideo();
              else e.target.pauseVideo();
            },
          },
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mounted, shorts]);

  // Observe visibility
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        let best = activeIdx;
        let bestRatio = 0;
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = idx;
          }
        }
        if (bestRatio >= 0.6 && best !== activeIdx) {
          setActiveIdx(best);
          setMounted((prev) => {
            const next = new Set(prev);
            for (let d = -2; d <= 2; d++) {
              const i = best + d;
              if (i >= 0 && i < shorts.length) next.add(i);
            }
            return next;
          });
        }
      },
      { root, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
    );
    itemRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [shorts.length, activeIdx]);

  // Play/pause on active change
  useEffect(() => {
    Object.entries(players.current).forEach(([k, p]) => {
      const i = Number(k);
      if (!p || typeof p.playVideo !== "function") return;
      try {
        if (i === activeIdx) p.playVideo();
        else p.pauseVideo();
      } catch {}
    });
  }, [activeIdx, mounted]);

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

  if (shorts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative snap-y snap-mandatory overflow-y-auto rounded-3xl border border-border bg-black scrollbar-hide"
      style={{ height: "calc(100dvh - 200px)", maxHeight: 720 }}
    >
      {/* Sound toggle */}
      <button
        onClick={() => setMuted((m) => !m)}
        className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"
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
            style={{ height: "calc(100dvh - 200px)", maxHeight: 720 }}
          >
            {/* Thumbnail beneath — instant paint */}
            <img
              src={`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`}
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

            {/* Tap-to-unmute hint on first short while muted */}
            {muted && i === activeIdx && (
              <button
                onClick={() => setMuted(false)}
                className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-black shadow-lg"
              >
                🔇 Tap for sound
              </button>
            )}

            {/* Overlay UI */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 text-white">
              <div className="pointer-events-auto max-w-[70%]">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur text-base">
                    {s.channelIcon}
                  </div>
                  <p className="text-sm font-semibold drop-shadow">{s.channelName}</p>
                </div>
                <p className="mt-2 text-xs opacity-90">#goa #susegad</p>
              </div>
              <div className="pointer-events-auto flex flex-col items-center gap-4">
                <button className="flex flex-col items-center text-xs font-semibold">
                  <Heart className="h-7 w-7 drop-shadow" />
                  <span>{((i * 7 + 12) % 90) + 10}k</span>
                </button>
                <button className="flex flex-col items-center text-xs font-semibold">
                  <MessageCircle className="h-7 w-7 drop-shadow" />
                  <span>{((i * 3 + 5) % 50) + 5}</span>
                </button>
                <button className="flex flex-col items-center text-xs font-semibold">
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
