import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { eventWhen, type GoaEvent } from "@/lib/events";

export function EventCard({ event, compact = false }: { event: GoaEvent; compact?: boolean }) {
  return (
    <article className="overflow-hidden rounded-[1.4rem] border border-border bg-card shadow-card">
      {event.image_url && !compact && (
        <img src={event.image_url} alt="" loading="lazy" decoding="async" className="h-40 w-full object-cover" />
      )}
      <div className="flex gap-3 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-xl text-primary-foreground">
          {event.emoji ?? "📅"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              {event.category}
            </span>
            {event.is_featured && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                Featured
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-foreground">{event.title}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> {eventWhen(event)}
          </p>
          {(event.venue || event.area) && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {[event.venue, event.area].filter(Boolean).join(", ")}
            </p>
          )}
          {!compact && event.description && (
            <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            {event.price && <span className="text-xs font-semibold text-foreground">{event.price}</span>}
            {event.ticket_url ? (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Ticket className="h-3.5 w-3.5" /> Details
              </a>
            ) : (
              <Link
                to="/events"
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold text-foreground"
              >
                All events
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
