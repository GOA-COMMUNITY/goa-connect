import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { EventCard } from "@/components/EventCard";
import { fetchUpcomingEvents, type GoaEvent } from "@/lib/events";

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

  const visible = (events ?? []).filter((event) => filter === "All" || event.area === filter);

  return (
    <AppLayout>
      <div className="px-3 py-4">
        <header className="mb-4 overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-card">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarDays className="h-6 w-6" /> What's on in Goa
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Markets, gigs, feasts and community meets — updated by the Goa Social team.
          </p>
        </header>

        {filters.length > 2 && (
          <div className="scrollbar-hide mb-4 flex gap-2 overflow-x-auto">
            {filters.map((area) => (
              <button
                key={area}
                onClick={() => setFilter(area)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${
                  filter === area
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-foreground"
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
              <div key={i} className="h-28 animate-pulse rounded-[1.4rem] bg-secondary" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No events listed yet — check back soon.
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
