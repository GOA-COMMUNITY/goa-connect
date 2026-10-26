import { Link, createFileRoute } from "@tanstack/react-router";
import { Music, Palmtree, Users, Utensils, CalendarDays, ArrowRight, Store, MessageCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SplashScreen } from "@/components/SplashScreen";
import { ShortsFeed, type Short } from "@/components/ShortsFeed";
import { useEffect, useRef, useState } from "react";
import { getCachedShorts, warmShorts } from "@/lib/shorts-warmup";
import { fetchUploadedShorts } from "@/lib/user-shorts";
import { rankShorts } from "@/lib/viewer-context";
import { getShortsSettings } from "@/lib/app-settings";
import { EventCard } from "@/components/EventCard";
import { fetchUpcomingEvents, type GoaEvent } from "@/lib/events";
import { fetchPoolShorts } from "@/lib/shorts-pool";


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
      { property: "og:description", content: "Connect with Goans, discover local businesses, events, and stories. Goa's own social network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [shorts, setShorts] = useState<Short[]>(initialVideos);
  const [events, setEvents] = useState<GoaEvent[]>([]);
  const [showSplash, setShowSplash] = useState(true);
  const [embedsEnabled, setEmbedsEnabled] = useState(true);
  const eventsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getShortsSettings().then((s) => setEmbedsEnabled(s.embedsEnabled));
  }, []);

  useEffect(() => {
    void fetchUpcomingEvents(6).then(setEvents);
  }, []);

  useEffect(() => {
    const cached = getCachedShorts();
    if (cached?.length) setShorts(cached);

    void warmShorts(initialVideos, (items) => setShorts(items));

    void Promise.all([
      fetchPoolShorts().catch(() => [] as Short[]),
      fetchUploadedShorts(20),
    ]).then(([pool, uploaded]) => {
      const combined = [...uploaded, ...pool];
      if (combined.length) setShorts(combined);
    });
  }, []);

  const ranked = rankShorts(shorts);

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <AppLayout>
      {!embedsEnabled && shorts.every((s) => !s.src) && (
        <div className="px-4 py-8">
          <div className="gs-hero-gradient rounded-3xl p-8 text-center text-white shadow-card gs-fade-in">
            <Palmtree className="mx-auto h-12 w-12 opacity-90" />
            <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
              Welcome to Goa Social
            </h1>
            <p className="mt-2 text-sm opacity-90">
              Goa's own community network. Connect with locals, discover events, explore businesses, and share your story.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <Users className="h-4 w-4" /> Meet Goans
              </Link>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <CalendarDays className="h-4 w-4" /> Events
              </Link>
              <Link
                to="/business"
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2.5 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/30"
              >
                <Store className="h-4 w-4" /> Businesses
              </Link>
            </div>
          </div>
        </div>
      )}

      <ShortsFeed shorts={ranked} />

      {events.length > 0 && (
        <div ref={eventsRef} className="px-3 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">This Week in Goa</h2>
              <p className="text-xs text-muted-foreground">Curated events from the Goa Social team</p>
            </div>
            <Link
              to="/events"
              className="flex items-center gap-1 text-xs font-semibold text-primary transition-opacity hover:opacity-70"
            >
              All events <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {events.slice(0, 4).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      <div className="px-3 pb-8 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/explore"
            className="gs-card-hover group rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-sm font-bold">Discover Goans</h3>
            <p className="mt-1 text-xs text-muted-foreground">Connect with locals and travellers across Goa</p>
          </Link>

          <Link
            to="/business"
            className="gs-card-hover group rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Utensils className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-sm font-bold">Local Businesses</h3>
            <p className="mt-1 text-xs text-muted-foreground">Cafes, shacks, surf schools &amp; more</p>
          </Link>

          <Link
            to="/events"
            className="gs-card-hover group rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-3/15 text-chart-3">
              <Music className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-sm font-bold">Events &amp; Parties</h3>
            <p className="mt-1 text-xs text-muted-foreground">Markets, gigs, feasts &amp; community meets</p>
          </Link>

          <Link
            to="/chats"
            className="gs-card-hover group rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-chart-4/15 text-chart-4">
              <MessageCircle className="h-5 w-5" />
            </div>
            <h3 className="mt-3 font-display text-sm font-bold">Community Chat</h3>
            <p className="mt-1 text-xs text-muted-foreground">Join conversations across North &amp; South Goa</p>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
