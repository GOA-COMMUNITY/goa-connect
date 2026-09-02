import { supabase } from "@/integrations/supabase/client";

export type GoaEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  area: string | null;
  venue: string | null;
  starts_at: string;
  ends_at: string | null;
  price: string | null;
  image_url: string | null;
  ticket_url: string | null;
  emoji: string | null;
  is_featured: boolean;
  is_published: boolean;
};

export const eventCategories = [
  "music",
  "market",
  "culture",
  "food",
  "nightlife",
  "sports",
  "community",
  "festival",
  "general",
] as const;

/** Upcoming published events, soonest first. */
export async function fetchUpcomingEvents(limit = 50): Promise<GoaEvent[]> {
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("is_published", true)
    .gte("starts_at", since)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as GoaEvent[];
}

export function eventWhen(event: Pick<GoaEvent, "starts_at">) {
  const date = new Date(event.starts_at);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86400000);
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  if (days > 1 && days < 7) return `${date.toLocaleDateString("en-IN", { weekday: "long" })} · ${time}`;
  return `${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${time}`;
}
