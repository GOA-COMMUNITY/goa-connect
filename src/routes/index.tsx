import { createFileRoute } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, Play, Sparkles, Users, Waves } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Goa Social — Community of Goa" },
      { name: "description", content: "Connect with Goans, discover local businesses, events, and stories. Goa's own social network." },
      { property: "og:title", content: "Goa Social — Community of Goa" },
      { property: "og:description", content: "Connect with Goans, discover local businesses, events, and stories." },
      { property: "og:type", content: "website" },
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

type Video = { videoId: string; channelName: string; channelIcon: string };

function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeChip, setActiveChip] = useState("For You");

  useEffect(() => {
    fetch("/videos.json")
      .then((r) => r.json())
      .then((v: Video[]) => setVideos(v.slice(0, 8)))
      .catch(() => {});
  }, []);

  return (
    <AppLayout>
      {/* Welcome hero */}
      <section className="mx-3 mt-3 overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-card">
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
        <div className="mt-4 flex items-center justify-between rounded-full border border-white/20 bg-white/10 px-4 py-3">
          <span className="text-sm font-medium">List your business</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">230+ joined</span>
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
              <div className="animate-story-glow mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-primary bg-secondary text-2xl">
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

      {/* Video feed */}
      <section className="px-3 py-4 space-y-5">
        {videos.map((v, i) => (
          <article key={v.videoId + i} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <header className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-lg">
                {v.channelIcon}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{v.channelName}</p>
                <p className="text-xs text-muted-foreground">Goa · just now</p>
              </div>
              <button className="text-xs font-semibold text-primary">Follow</button>
            </header>
            <div className="relative aspect-[9/16] max-h-[560px] w-full bg-black">
              <img
                src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <a
                href={`https://youtube.com/shorts/${v.videoId}`}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary shadow-card">
                  <Play className="h-7 w-7 fill-current" />
                </div>
              </a>
            </div>
            <footer className="flex items-center gap-5 p-4 text-muted-foreground">
              <button className="flex items-center gap-1.5 hover:text-destructive">
                <Heart className="h-5 w-5" />
                <span className="text-sm font-medium">{(Math.random() * 5 + 1).toFixed(1)}k</span>
              </button>
              <button className="flex items-center gap-1.5 hover:text-primary">
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-medium">{Math.floor(Math.random() * 200)}</span>
              </button>
              <button className="ml-auto flex items-center gap-1.5 hover:text-primary">
                <Share2 className="h-5 w-5" />
              </button>
            </footer>
          </article>
        ))}
        {videos.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center text-muted-foreground">
            Loading Goa stories…
          </div>
        )}
      </section>
    </AppLayout>
  );
}
