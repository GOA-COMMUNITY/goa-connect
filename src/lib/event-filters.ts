import type { GoaEvent } from "@/lib/events";

const NORTH = ["anjuna", "vagator", "morjim", "calangute", "baga", "candolim", "assagao", "arpora", "siolim", "mapusa", "arambol", "ashwem", "mandrem", "porvorim", "chapora", "north"];
const SOUTH = ["margao", "palolem", "benaulim", "colva", "agonda", "vasco", "cavelossim", "majorda", "betalbatim", "canacona", "patnem", "varca", "south"];

export type Region = "All" | "North" | "South";
export type When = "All" | "Tonight" | "Weekend";

export function regionOf(e: GoaEvent): Region | null {
  const t = `${e.area ?? ""} ${e.venue ?? ""}`.toLowerCase();
  if (NORTH.some((w) => t.includes(w))) return "North";
  if (SOUTH.some((w) => t.includes(w))) return "South";
  return null;
}

export function matchesWhen(e: GoaEvent, when: When, now = new Date()): boolean {
  if (when === "All") return true;
  const start = new Date(e.starts_at);
  const end = e.ends_at ? new Date(e.ends_at) : start;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (when === "Tonight") {
    const dayEnd = new Date(dayStart.getTime() + 30 * 3600_000); // until 6am next day
    return start < dayEnd && end >= dayStart;
  }
  const dow = now.getDay();
  const toFri = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  const fri = new Date(dayStart.getTime() + toFri * 86400_000);
  const from = dow === 6 || dow === 0 ? dayStart : fri;
  const mon = new Date(fri.getTime() + 3 * 86400_000 + 6 * 3600_000);
  return start < mon && end >= from;
}

export function whatsappShareUrl(e: GoaEvent, when: string): string {
  const where = [e.venue, e.area].filter(Boolean).join(", ");
  const text = `🌴 ${e.title}\n📅 ${when}${where ? `\n📍 ${where}` : ""}\nWho's in? 🙌\nhttps://goasocial.in/events`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
