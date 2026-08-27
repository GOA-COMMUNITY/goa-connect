import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ShortsFeed, type Short } from "@/components/ShortsFeed";
import { fetchUploadedShort, isUploadedId } from "@/lib/user-shorts";

export const Route = createFileRoute("/s/$id")({
  head: () => ({
    meta: [
      { title: "Watch a Short — Goa Social" },
      { name: "description", content: "Watch and share this Goa Social short." },
      { property: "og:title", content: "Watch a Short — Goa Social" },
      { property: "og:description", content: "Watch and share this Goa Social short." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedShort,
});

function SharedShort() {
  const { id } = Route.useParams();
  const [short, setShort] = useState<Short | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    async function load() {
      if (isUploadedId(id)) {
        const item = await fetchUploadedShort(id.slice(2));
        if (active) setShort(item);
        return;
      }
      try {
        const response = await fetch("/cached-shorts.json", { cache: "no-store" });
        const items = (await response.json()) as Short[];
        const item = Array.isArray(items) ? items.find((candidate) => candidate.videoId === id) : undefined;
        if (active) setShort(item ?? null);
      } catch {
        if (active) setShort(null);
      }
    }
    void load();
    return () => { active = false; };
  }, [id]);

  return (
    <main className="min-h-screen bg-background px-2 pb-6 pt-2 sm:px-4">
      <div className="mx-auto max-w-xl">
        <div className="mb-2 flex items-center justify-between px-1">
          <Link to="/" className="flex items-center gap-2 rounded-full bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-soft">
            <ArrowLeft className="h-4 w-4" /> Goa Social
          </Link>
          <span className="text-xs font-semibold text-muted-foreground">Shared Short</span>
        </div>
        {short === undefined && <div className="flex h-[70svh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {short && <ShortsFeed shorts={[short]} />}
        {short === null && (
          <div className="mt-20 text-center">
            <h1 className="text-xl font-bold text-foreground">This short is no longer available</h1>
            <p className="mt-2 text-sm text-muted-foreground">The daily pool may have refreshed, or the creator removed it.</p>
            <Link to="/" className="mt-5 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Watch latest Shorts</Link>
          </div>
        )}
      </div>
    </main>
  );
}