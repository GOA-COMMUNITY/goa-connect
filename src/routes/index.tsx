import { Link, createFileRoute } from "@tanstack/react-router";
import { Coffee, Music, Palmtree, Shell, Sparkles, Sun, Users, Utensils, Waves } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SplashScreen } from "@/components/SplashScreen";
import { ShortsFeed, type Short } from "@/components/ShortsFeed";
import { useEffect, useRef, useState } from "react";
import { getCachedShorts, warmShorts } from "@/lib/shorts-warmup";
import { rankShorts } from "@/lib/viewer-context";
import { getShortsSettings } from "@/lib/app-settings";


const initialVideos: Short[] = [
  { videoId: "CNiJy7Hsqbg", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "cf2iERWZlN8", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "Dr4oT3py-JM", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "Th1uHSz852U", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "09y1GEuqfu8", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "l8oM3p6QUpI", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "M8bQEtHUEF8", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "qioLzSJ0iqI", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "oXVstGTHpRs", channelName: "Adventure Goa DK", channelIcon: "🌴" },
  { videoId: "TZMLSP66eOw", channelName: "Adventure Goa DK", channelIcon: "🌴" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Goa Social — Community of Goa" },
      { name: "description", content: "Connect with Goans, discover local businesses, events, and stories. Goa's own social network." },
      { property: "og:title", content: "Goa Social — Community of Goa" },
      { property: "og:description", content: "Connect with Goans, discover local businesses, events, and stories." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "preconnect", href: "https://www.youtube.com" },
      { rel: "preconnect", href: "https://www.youtube-nocookie.com" },
      { rel: "preconnect", href: "https://i.ytimg.com" },
      { rel: "preconnect", href: "https://s.ytimg.com" },
      { rel: "dns-prefetch", href: "https://www.google.com" },
      ...initialVideos.slice(0, 1).map((video, index) => ({
        rel: "preload",
        as: "image",
        href: `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
        fetchPriority: (index === 0 ? "high" : "low") as "high" | "low",
      })),
    ],
  }),
  component: Home,
});

const stories = [
  { name: "Beaches", icon: Shell },
  { name: "Food", icon: Utensils },
  { name: "Festivals", icon: Sparkles },
  { name: "Music", icon: Music },
  { name: "Surf", icon: Waves },
  { name: "Cafes", icon: Coffee },
  { name: "Sunsets", icon: Sun },
];

const chips = ["For You", "North Goa", "South Goa", "Trending", "Food", "Events", "Music", "Beaches"];

function Home() {
  const [videos, setVideos] = useState<Short[]>(() => getCachedShorts() ?? initialVideos);
  const [activeChip, setActiveChip] = useState("For You");
  const embedsAllowed = useRef(false);

  useEffect(() => {
    const sharedShort = new URLSearchParams(window.location.search).get("short");
    let cached: Short[] = [];

    const merge = (items: Short[]) => {
      const seen = new Set(cached.map((short) => short.videoId));
      let combined = [...cached, ...items.filter((short) => !seen.has(short.videoId))];
      // Admin can switch off YouTube live-frame shorts — then only our own downloads play.
      if (!embedsAllowed.current) combined = combined.filter((short) => !!short.src);
      const ranked = rankShorts(combined);
      if (!sharedShort) return ranked;
      const match = ranked.find((video) => video.videoId === sharedShort);
      return match ? [match, ...ranked.filter((video) => video.videoId !== sharedShort)] : ranked;
    };

    // Shorts pre-cached on Goa Social's own hosting play instantly — show them first.
    // `no-cache` still revalidates every load, but a 304 costs far less than a full re-download.
    void fetch("/cached-shorts.json", { cache: "no-cache" })
      .then((response) => response.json())
      .then((items: Short[]) => {
        if (!Array.isArray(items) || items.length === 0) return;
        cached = items;
        setVideos((current) => merge(current));
      })
      .catch(() => {});

    setVideos((current) => merge(current));

    // Everything below is non-critical for first paint — run it once the browser is idle
    // so the first short starts rendering as early as possible.
    const idle = (fn: () => void) => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
        .requestIdleCallback;
      if (ric) ric(fn, { timeout: 800 });
      else window.setTimeout(fn, 200);
    };

    idle(() => {
      void getShortsSettings().then((settings) => {
        embedsAllowed.current = settings.embedsEnabled;
        setVideos((current) => merge(current));
      });
      // Warm YouTube origins + buffer the first streamed shorts while the splash plays.
      void warmShorts(initialVideos, (items) => setVideos(merge(items)));
    });
  }, []);

  return (
    <SplashScreen duration={1100}>
      <AppLayout showEventBanner={false}>
        {/* One feed instance prevents duplicate observers, players and network listeners. */}
        <section className="px-2 pt-2 sm:px-3">
          <ShortsFeed shorts={videos} />
        </section>

        {/* Everything under the feed is below the fold — `gs-defer` lets the browser
            skip its layout/paint work until the user scrolls there. */}
        <div className="gs-defer">
          {/* 📋 Dashboard / welcome hero */}
          <section className="relative mx-3 mt-4 overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-card">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <h1 className="relative flex items-end gap-2 text-3xl font-bold leading-tight">
              <span>Susegad,<br />welcome home</span>
              <Palmtree className="mb-1 h-7 w-7" />
            </h1>
            <p className="relative mt-2 text-sm opacity-90">Goa's own social network — by Goans, for Goans.</p>
            <div className="relative mt-5 grid grid-cols-3 gap-3">
              {[
                { icon: Users, label: "Only Goans" },
                { icon: Sparkles, label: "Verified" },
                { icon: Waves, label: "Local Vibe" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="rounded-2xl border border-white/20 bg-white/15 p-3 text-center">
                  <Icon className="mx-auto h-6 w-6" />
                  <p className="mt-1 text-[11px] font-semibold">{label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 📖 Stories */}
          <section className="mt-4 bg-card py-4">
            <div className="mb-3 flex items-center justify-between px-4">
              <h2 className="text-base font-semibold text-foreground">Live Stories</h2>
              <div className="flex items-center gap-3">
                <Link to="/my-feed" className="text-sm font-medium text-muted-foreground">Your feed</Link>
                <Link to="/explore" className="text-sm font-medium text-primary">See all</Link>
              </div>
            </div>
            <div className="scrollbar-hide flex gap-4 overflow-x-auto px-4">
              {stories.map((s) => {
                const Icon = s.icon;
                return (
                  <Link to="/explore" key={s.name} className="shrink-0 text-center">
                    <div className="mx-auto rounded-full bg-gradient-primary p-[3px]">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-primary">
                        <Icon className="h-7 w-7" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{s.name}</p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* 🏷️ Category chips */}
          <section className="bg-card pb-3 pt-1">
            <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => setActiveChip(c)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    activeChip === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* 📢 Ad / business slot */}
          <section className="mx-3 mt-4 mb-6 overflow-hidden rounded-3xl border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Sponsored</p>
            <h3 className="mt-1 text-lg font-bold text-foreground">Grow your Goan business 🌴</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Reach thousands of locals &amp; tourists. Your ad here.
            </p>
            <Link
              to="/business"
              className="mt-3 inline-block rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow"
            >
              Advertise with us
            </Link>
          </section>
        </div>

      </AppLayout>
    </SplashScreen>
  );
}

