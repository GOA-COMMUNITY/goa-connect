// Pulls Goan events/news from admin-configured feeds (RSS, Atom or iCal)
// and files them as draft events that the admin can publish.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ImportReport = {
  source: string;
  status: string;
  found: number;
  added: number;
};

type SourceRow = {
  id: string;
  name: string;
  url: string;
  kind: string;
  area: string | null;
  category: string;
  auto_publish: boolean;
};

type ParsedItem = {
  title: string;
  description: string | null;
  starts_at: string;
  link: string;
};

const strip = (s: string) =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? strip(m[1]) : "";
};

function parseFeed(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];

  // iCalendar
  if (text.includes("BEGIN:VEVENT")) {
    for (const block of text.split("BEGIN:VEVENT").slice(1)) {
      const get = (k: string) => block.match(new RegExp(`^${k}[^:\\n]*:(.*)$`, "mi"))?.[1]?.trim() ?? "";
      const raw = get("DTSTART");
      const title = get("SUMMARY");
      if (!raw || !title) continue;
      const iso = raw.length >= 15
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:00Z`
        : `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T10:00:00+05:30`;
      const when = new Date(iso);
      if (Number.isNaN(when.getTime())) continue;
      items.push({
        title,
        description: get("DESCRIPTION") || null,
        starts_at: when.toISOString(),
        link: get("URL") || `${get("UID")}@ics`,
      });
    }
    return items;
  }

  // RSS / Atom
  const blocks = text.split(/<item[\s>]/i).slice(1).concat(text.split(/<entry[\s>]/i).slice(1));
  for (const chunk of blocks) {
    const block = chunk.split(/<\/(item|entry)>/i)[0] ?? chunk;
    const title = tag(block, "title");
    if (!title) continue;
    const dateText = tag(block, "pubDate") || tag(block, "updated") || tag(block, "published") || tag(block, "dc:date");
    const when = dateText ? new Date(dateText) : new Date();
    const link =
      tag(block, "link") ||
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
      tag(block, "guid") ||
      title;
    items.push({
      title,
      description: (tag(block, "description") || tag(block, "summary") || "").slice(0, 600) || null,
      starts_at: (Number.isNaN(when.getTime()) ? new Date() : when).toISOString(),
      link: strip(link),
    });
  }
  return items;
}

/** Shared engine, used by the admin button and the cron endpoint. */
export async function runEventImport(sourceIds?: string[]): Promise<ImportReport[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let query = supabaseAdmin.from("event_sources").select("*").eq("is_enabled", true);
  if (sourceIds?.length) query = query.in("id", sourceIds);
  const { data } = await query;
  const sources = (data ?? []) as unknown as SourceRow[];

  const reports: ImportReport[] = [];
  for (const source of sources) {
    let status = "ok";
    let found = 0;
    let added = 0;
    try {
      const res = await fetch(source.url, {
        headers: { "user-agent": "GoaSocialBot/1.0 (+https://goasocial.in)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text()).slice(0, 25);
      found = items.length;

      for (const item of items) {
        const { error } = await supabaseAdmin.from("events").insert({
          title: item.title.slice(0, 180),
          description: item.description,
          category: source.category,
          area: source.area,
          starts_at: item.starts_at,
          source_url: item.link.slice(0, 500),
          source_id: source.id,
          is_published: source.auto_publish,
        } as never);
        if (!error) added += 1;
      }
    } catch (e) {
      status = e instanceof Error ? e.message.slice(0, 120) : "failed";
    }

    await supabaseAdmin
      .from("event_sources")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: status,
        last_count: added,
      } as never)
      .eq("id", source.id);

    reports.push({ source: source.name, status, found, added });
  }
  return reports;
}

async function assertAdmin(context: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (data !== true) throw new Error("Forbidden");
}

export const importEventsNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceIds?: string[] }) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    return { reports: await runEventImport(data.sourceIds) };
  });
