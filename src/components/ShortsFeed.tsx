import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";

export type Short = {
  videoId: string;
  channelName: string;
  channelIcon: string;
};

/**
 * Vertical, snap-scrolling reels feed.
 * - IntersectionObserver picks the SINGLE most-visible card and plays only that one.
 *   Fixes the bug where scrolling down played the previous (upper) short.
 * - First short is rendered eagerly with a muted autoplay iframe so it warms
 *   up under the splash and is ready by the time the splash fades.
 * - Other shorts mount their iframe lazily once they come close to viewport.
 */
export function ShortsFeed({ shorts }: { shorts: Short[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  // Indices that have been mounted (iframe rendered). Always include 0 for fast first paint.
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1]));

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio that is currently visible.
        let bestIdx = activeIdx;
        let bestRatio = 0;
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.idx);
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestIdx = idx;
          }
        }
        if (bestRatio >= 0.6) {
          setActiveIdx(bestIdx);
          // Preload neighbours (next & prev) so scroll feels instant
          setMounted((prev) => {
            const next = new Set(prev);
            next.add(bestIdx);
            if (bestIdx + 1 < shorts.length) next.add(bestIdx + 1);
            if (bestIdx - 1 >= 0) next.add(bestIdx - 1);
            return next;
          });
        }
      },
      { root, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
    );

    itemRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [shorts.length, activeIdx]);

  if (shorts.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="snap-y snap-mandatory overflow-y-auto h-[80vh] max-h-[700px] rounded-3xl border border-border bg-black scrollbar-hide"
    >
      {shorts.map((s, i) => {
        const isActive = i === activeIdx;
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
            {/* Thumbnail always shown for instant paint */}
            <img
              src={`https://i.ytimg.com/vi/${s.videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-90"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
            />
            {shouldMount && (
              <iframe
                key={isActive ? "play" : "pause"}
                src={`https://www.youtube.com/embed/${s.videoId}?autoplay=${
                  isActive ? 1 : 0
                }&mute=1&controls=0&loop=1&playlist=${s.videoId}&playsinline=1&modestbranding=1&rel=0`}
                title={s.channelName}
                allow="autoplay; encrypted-media; picture-in-picture"
                className="absolute inset-0 h-full w-full"
                style={{ border: 0 }}
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
