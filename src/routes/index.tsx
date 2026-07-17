import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Users, Waves } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SplashScreen } from "@/components/SplashScreen";
import { ShortsFeed, type Short } from "@/components/ShortsFeed";
import { useEffect, useState } from "react";

const initialVideos: Short[] = [
  { videoId: "vsTOfkinlCc", channelName: "Goa Social", channelIcon: "🌴" },
  { videoId: "XjaqknGJ538", channelName: "Goa Vibes", channelIcon: "🏖️" },
  { videoId: "nB6TZ3RvJz4", channelName: "Susegad Shorts", channelIcon: "🌊" },
  { videoId: "TKBcv3WngNM", channelName: "Goa Nights", channelIcon: "🎵" },
  { videoId: "5d8NIJDA3pA", channelName: "Local Goa", channelIcon: "🥥" },
  { videoId: "TAI7TjBE6_s", channelName: "Beach Feed", channelIcon: "🌅" },
  { videoId: "Phx53r74bIU", channelName: "Goa Social", channelIcon: "🦐" },
  { videoId: "aSp-Va-OBX8", channelName: "Goa Vibes", channelIcon: "🏄" },
  { videoId: "RVoH_7lZAoE", channelName: "Susegad Shorts", channelIcon: "☕" },
  { videoId: "in1QNb1YCb8", channelName: "Local Goa", channelIcon: "🎭" },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Goa Social — Community of Goa" },
      { name: "description", content: "Connect with Goans, discover local businesses, events, and stories. Goa's own social network." },
      { property: "og:title", content: "Goa Social — Community of Goa" },
      { property: "og:description", content: "Connect with Goans, discover local businesses, events, and stories." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://www.youtube.com" },
      { rel: "preconnect", href: "https://www.youtube-nocookie.com" },
      { rel: "preconnect", href: "https://i.ytimg.com" },
      { rel: "preconnect", href: "https://s.ytimg.com" },
      { rel: "dns-prefetch", href: "https://www.google.com" },
      ...initialVideos.slice(0, 3).map((video, index) => ({
        rel: "preload",
        as: "image",
        href: `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`,
        fetchPriority: index === 0 ? "high" : "low",
      })),
    ],
  }),
  component: Home,
});

const stories = [
  { name: "Beaches", emoji: "🏖️" },
  { name: "Food", emoji: "🦐" },
  { name: "Festivals", emoji: "🎭" },
  { name: "Music", emoji: "🎵" },
  { name: "Surf", emoji: "🏄" },
  { name: "Cafes", emoji: "☕" },
  { name: "Sunsets", emoji: "🌅" },
];

const chips = ["For You", "North Goa", "South Goa", "Trending", "Food", "Events", "Music", "Beaches"];

function Home() {
  const [videos, setVideos] = useState<Short[]>(initialVideos);
  const [activeChip, setActiveChip] = useState("For You");

  useEffect(() => {
    // Fetch early so the first short can preload under the splash
    fetch("/videos.json")
      .then((r) => r.json())
      .then((v: Short[]) => setVideos(v.slice(0, 10)))
      .catch(() => {});
  }, []);

  return (
    <SplashScreen duration={7500}>
      <AppLayout showEventBanner={false}>
        {/* Shorts feed FIRST so it warms up during splash */}
        <section className="px-2 pt-2 sm:px-3">
          <ShortsFeed shorts={videos} />
        </section>

        {/* Welcome hero */}
        <section className="mx-3 mt-4 overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-card">
          <h1 className="text-3xl font-bold leading-tight">Susegad,<br />welcome home 🌴</h1>
          <p className="mt-2 text-sm opacity-90">Goa's own social network — by Goans, for Goans.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { icon: Users, label: "Only Goans" },
              { icon: Sparkles, label: "Verified" },
              { icon: Waves, label: "Local Vibe" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-white/20 bg-white/15 p-3 text-center backdrop-blur">
                <Icon className="mx-auto h-6 w-6" />
                <p className="mt-1 text-[11px] font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stories */}
        <section className="mt-4 bg-card py-4">
          <div className="mb-3 flex items-center justify-between px-4">
            <h2 className="text-base font-semibold text-foreground">Live Stories</h2>
            <a className="text-sm font-medium text-primary">See all</a>
          </div>
          <div className="scrollbar-hide flex gap-4 overflow-x-auto px-4">
            {stories.map((s) => (
              <div key={s.name} className="shrink-0 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-primary bg-secondary text-2xl">
                  {s.emoji}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{s.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Category chips */}
        <section className="bg-card pb-3 pt-1">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => setActiveChip(c)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
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
      </AppLayout>
    </SplashScreen>
  );
}
