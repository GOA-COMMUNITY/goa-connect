import { createFileRoute } from "@tanstack/react-router";
import { Star, MapPin, Clock, Phone, Plus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Goa Business Directory — Goa Social" },
      { name: "description", content: "Discover the best restaurants, cafes, surf schools, and local businesses in Goa." },
      { property: "og:title", content: "Goa Business Directory — Goa Social" },
      { property: "og:description", content: "Discover the best restaurants, cafes, surf schools and local businesses in Goa." },
    ],
  }),
  component: Business,
});

const businesses = [
  {
    name: "Fisherman's Wharf",
    desc: "Famous for crab xec xec and live music. Riverside dining in Panjim.",
    rating: 4.7,
    reviews: "1.2k",
    tags: ["🍽️ Goan", "📍 1.2km", "🕒 11am–11pm"],
    gradient: "from-primary to-primary-glow",
    cta: "Contact Business",
  },
  {
    name: "Goa Surf School",
    desc: "Learn to surf with certified instructors. Equipment provided. Morjim beach.",
    rating: 4.9,
    reviews: "876",
    tags: ["🏄 Surfing", "📍 3.5km", "👥 Groups"],
    gradient: "from-emerald-500 to-teal-600",
    cta: "Book Now",
  },
  {
    name: "Cafe Alchemia",
    desc: "Artsy cafe in Assagao. Specialty coffee, vegan menu, slow Sundays.",
    rating: 4.8,
    reviews: "542",
    tags: ["☕ Cafe", "📍 5.1km", "🌱 Vegan"],
    gradient: "from-amber-500 to-orange-600",
    cta: "Visit Page",
  },
  {
    name: "Saraya Art Village",
    desc: "Live music, ceramics, weekend markets in Sangolda. The North Goa hangout.",
    rating: 4.6,
    reviews: "318",
    tags: ["🎨 Art", "🎵 Live", "📍 6.2km"],
    gradient: "from-violet-500 to-fuchsia-600",
    cta: "See Events",
  },
];

function Business() {
  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Goa Directory</h1>
            <p className="text-sm text-muted-foreground">Hand-picked local businesses</p>
          </div>
          <button className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft">
            <Plus className="h-4 w-4" /> List
          </button>
        </div>

        {businesses.map((b) => (
          <article key={b.name} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className={`relative h-32 bg-gradient-to-br ${b.gradient}`}>
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <h3 className="text-xl font-bold drop-shadow">{b.name}</h3>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                  <Star className="h-3 w-3 fill-current" /> {b.rating} ({b.reviews} reviews)
                </span>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted-foreground">{b.desc}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {b.tags.map((t) => (
                  <span key={t} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
                  {b.cta}
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground">
                  <Phone className="h-4 w-4" />
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground">
                  <MapPin className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </AppLayout>
  );
}
