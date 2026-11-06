import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { EventCard } from "@/components/EventCard";
import { fetchUpcomingEvents, type GoaEvent } from "@/lib/events";
import { matchesWhen, regionOf, type Region, type When } from "@/lib/event-filters";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Goa Events This Week — Goa Social" },
      {
        name: "description",
        content:
          "Every party, market, festival and community event happening in Goa this week — curated by Goa Social.",
      },
      { property: "og:title", content: "Goa Events This Week — Goa Social" },
      {
        property: "og:description",
        content: "Parties, night markets, festivals and community meets across North and South Goa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const [events, setEvents] = useState<GoaEvent[] | null>(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    void fetchUpcomingEvents(100).then(setEvents);
  }, []);

  const filters = useMemo(() => {
    const areas = new Set<string>();
    (events ?? []).forEach((event) => event.area && areas.add(event.area));
    return ["All", ...Array.from(areas)];
  }, [events]);

  const [when, setWhen] = useState<When>("All");
  const [region, setRegion] = useState<Region>("All");
  const visible = (events ?? []).filter(
    (event) =>
      (filter === "All" || event.area === filter) &&
      matchesWhen(event, when) &&
      (region === "All" || regionOf(event) === region),
  );
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
      active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-card text-foreground"
    }`;

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <header className="mb-5 overflow-hidden rounded-[1.6rem] bg-gradient-primary p-6 text-primary-foreground shadow-card">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <CalendarDays className="h-6 w-6" /> What's on in Goa
          </h1>
          <p className="mt-1.5 text-sm font-medium opacity-90">
            Markets, gigs, feasts and community meets — updated by the Goa Social team.
          </p>
        </header>

        <div className="scrollbar-hide mb-2 flex gap-2 overflow-x-auto">
          {(["All", "Tonight", "Weekend"] as When[]).map((w) => (
            <button key={w} onClick={() => setWhen(w)} className={chip(when === w)}>
              {w === "Tonight" ? "🌙 Tonight in Goa" : w === "Weekend" ? "🎉 This weekend" : "Any day"}
            </button>
          ))}
        </div>
        <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto">
          {(["All", "North", "South"] as Region[]).map((r) => (
            <button key={r} onClick={() => setRegion(r)} className={chip(region === r)}>
              {r === "All" ? "All Goa" : `${r} Goa`}
            </button>
          ))}
        </div>

        {filters.length > 2 && (
          <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto">
            {filters.map((area) => (
              <button
                key={area}
                onClick={() => setFilter(area)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-semibold transition-all active:scale-95 ${
                  filter === area
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {area}
              </button>
            ))}
          </div>
        )}

        {events === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="gs-shimmer h-32 rounded-[1.4rem] bg-secondary" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center shadow-soft">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              No events listed yet — check back soon.
            </p>
          </div>
        ) : (
          <div className="gs-stagger space-y-3">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
