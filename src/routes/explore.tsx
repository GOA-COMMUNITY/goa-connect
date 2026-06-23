import { createFileRoute } from "@tanstack/react-router";
import { Search, CheckCircle2, MapPin, MessageCircle, UserPlus } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore Goans — Goa Social" },
      { name: "description", content: "Discover and connect with verified Goans across North and South Goa." },
      { property: "og:title", content: "Explore Goans — Goa Social" },
      { property: "og:description", content: "Discover and connect with verified Goans across North and South Goa." },
    ],
  }),
  component: Explore,
});

const chips = ["All Goans", "North Goa", "South Goa", "Artists", "Foodies", "Surfers", "Musicians"];

const people = [
  { name: "Rohan Pereira", handle: "@rohan_p", area: "Panjim", bio: "Surfer · Foodie · Sunset chaser 🌊", color: "from-primary to-primary-glow" },
  { name: "Anjali Naik", handle: "@anjali.art", area: "Mapusa", bio: "Artist · Carnival costumes · Goan stories 🎨", color: "from-pink-500 to-rose-500" },
  { name: "Vikas Gaonkar", handle: "@vikascafe", area: "Assagao", bio: "Cafe Alchemia owner · Coffee nerd ☕", color: "from-emerald-500 to-teal-600" },
  { name: "Maria D'Souza", handle: "@maria.tales", area: "Margao", bio: "Writer · History buff · Sao Joao lover 📚", color: "from-amber-500 to-orange-600" },
  { name: "Kabir Shenoy", handle: "@kabir.beats", area: "Anjuna", bio: "DJ · Trance · Producing in Goa 🎧", color: "from-violet-500 to-fuchsia-600" },
];

function Explore() {
  const [active, setActive] = useState("All Goans");

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-soft">
          <Search className="h-5 w-5 text-primary" />
          <input
            placeholder="Search Goans, places, vibes…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-3 rounded-3xl bg-gradient-primary p-4 text-primary-foreground shadow-card">
          <CheckCircle2 className="h-7 w-7" />
          <div className="flex-1">
            <p className="text-sm font-bold">Only Goans Community</p>
            <p className="text-xs opacity-90">Verified Goan profiles only</p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
            2 free msgs
          </span>
        </div>

        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                active === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {people.map((p) => (
            <div key={p.handle} className="rounded-3xl border border-border bg-card p-4 shadow-soft">
              <div className="flex gap-4">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${p.color} text-2xl font-bold text-white`}>
                  {p.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Goan</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {p.area} · {p.handle}
                  </p>
                  <p className="mt-1.5 text-sm text-foreground">{p.bio}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground">
                  <MessageCircle className="h-4 w-4" /> Message
                </button>
                <button className="flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground">
                  <UserPlus className="h-4 w-4" /> Follow
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
