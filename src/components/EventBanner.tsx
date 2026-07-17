import { useEffect, useState } from "react";
import { X, Calendar } from "lucide-react";

type GoaEvent = { name: string; date: string; description?: string };

export function EventBanner() {
  const [event, setEvent] = useState<{ event: GoaEvent; days: number } | null>(null);
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && sessionStorage.getItem("gs_event_dismissed") === "1");

  useEffect(() => {
    fetch("/events.json")
      .then((r) => r.json())
      .then((events: GoaEvent[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        for (const ev of events) {
          const d = new Date(ev.date);
          d.setHours(0, 0, 0, 0);
          const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
          if (days >= 0 && days <= 30) {
            setEvent({ event: ev, days });
            return;
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!event || dismissed) return null;

  return (
    <div className="mx-auto max-w-2xl px-3 pt-3">
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-card">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
          <Calendar className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold">{event.event.name}</p>
          <p className="text-xs opacity-90">
            {event.days === 0 ? "Today!" : `In ${event.days} day${event.days > 1 ? "s" : ""}`}
            {event.event.description ? ` · ${event.event.description}` : ""}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          onPointerDown={() => sessionStorage.setItem("gs_event_dismissed", "1")}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
