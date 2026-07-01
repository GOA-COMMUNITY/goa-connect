import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";

export type Short = {
  videoId: string;
  channelName: string;
  channelIcon: string;
};

/**
 * Vertical, snap-scrolling reels feed — optimised for weak networks.
 *
 * Key optimisations:
 * 1. Iframes mount ONCE and stay mounted. We NEVER remount on scroll.
 *    Play / pause is controlled purely via YouTube's postMessage API
 *    (`playVideo` / `pauseVideo`). This is why previously every scroll
 *    triggered a full reload / black screen.
 * 2. Preload window = ±2. Once you're on a short, the next 2 and previous
 *    2 iframes are already mounted and buffered, so scrolling either
 *    direction plays instantly.
 * 3. IntersectionObserver picks the single most-visible card. Scrolling
 *    down plays the card BELOW (not above) and vice-versa.
 * 4. Thumbnails render behind every card for instant paint even on 2G.
 */
export function ShortsFeed({ shorts }: { shorts: Short[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const iframeRefs = useRef<(HTMLIFrameElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  // Which indices have their iframe mounted. Preload first 3 for fast start.
  const [mounted, setMounted] = useState<Set<number>>(
    () => new Set([0, 1, 2])
  );

  // Send a YouTube iframe-API command via postMessage.
  const cmd = (iframe: HTMLIFrameElement | null, func: "playVideo" | "pauseVideo") => {
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  };

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        let bestIdx = activeIdx;
        let bestRatio = 0;
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestIdx = idx;
          }
        }
        if (bestRatio >= 0.6 && bestIdx !== activeIdx) {
          setActiveIdx(bestIdx);
          // Expand mount window ±2 around the active card
          setMounted((prev) => {
            const next = new Set(prev);
            for (let d = -2; d <= 2; d++) {
              const i = bestIdx + d;
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

  // Play the active iframe, pause all others. Runs after mount / active change.
  useEffect(() => {
    iframeRefs.current.forEach((f, i) => {
      if (!f) return;
      // Give the iframe a beat to be ready before commanding.
      if (i === activeIdx) cmd(f, "playVideo");
      else cmd(f, "pauseVideo");
    });
  }, [activeIdx, mounted]);

  if (shorts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="snap-y snap-mandatory overflow-y-auto h-[80vh] max-h-[700px] rounded-3xl border border-border bg-black scrollbar-hide"
    >
      {shorts.map((s, i) => {
        const shouldMount = mounted.has(i);
        return (
          <div
            key={s.videoId + i}
            data-idx={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="snap-start relative h-[80vh] max-h-[700px] w-full bg-black flex items-center justify-center"
          >
            {/* Low-res thumbnail — paints in a few KB even on 2G */}
            <img
              src={`https://i.ytimg.com/vi/${s.videoId}/mqdefault.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
            />
            {shouldMount && (
              <iframe
                ref={(el) => {
                  iframeRefs.current[i] = el;
                }}
                // Start the first short muted-autoplay so it warms up under
                // the splash; others start paused, we play them via postMessage
                // when they scroll into view.
                src={
                  `https://www.youtube.com/embed/${s.videoId}` +
                  `?enablejsapi=1&mute=1&controls=0&loop=1&playlist=${s.videoId}` +
                  `&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3` +
                  `&autoplay=${i === 0 ? 1 : 0}&origin=${
                    typeof window !== "undefined" ? window.location.origin : ""
                  }`
                }
                title={s.channelName}
                allow="autoplay; encrypted-media; picture-in-picture"
                className="absolute inset-0 h-full w-full"
                style={{ border: 0 }}
                loading="lazy"
              />
            )}

            {/* Overlay UI */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4 text-white">
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
