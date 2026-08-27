import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Brain, Clock, Eye, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { clearContext, contextSummary, CONTEXT_TTL_DAYS } from "@/lib/viewer-context";
import { toast } from "sonner";

export const Route = createFileRoute("/my-feed")({
  head: () => ({
    meta: [
      { title: "Your Feed Brain — Goa Social" },
      { name: "description", content: "See how Goa Social picks your Shorts: the Goan channels you watch most, your watch time, and one-tap reset." },
      { property: "og:title", content: "Your Feed Brain — Goa Social" },
      { property: "og:description", content: "The channels you watch most decide what plays first. Private, on-device, auto-erased." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyFeed,
});

function MyFeed() {
  const [summary, setSummary] = useState(() => ({ channels: [] as ReturnType<typeof contextSummary>["channels"], totalMinutes: 0, seenCount: 0, expiresInDays: CONTEXT_TTL_DAYS }));

  useEffect(() => { setSummary(contextSummary()); }, []);

  const top = summary.channels.slice(0, 8);
  const max = Math.max(1, ...top.map((c) => Math.max(1, c.score)));

  return (
    <AppLayout showEventBanner={false}>
      <div className="px-4 pb-10 pt-4">
        <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Brain className="h-6 w-6 text-primary" /> Your feed brain
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Goa Social downloads 100 fresh Goan Shorts every day. This little on-device profile decides
          which of them play first for you. It never leaves your phone and erases itself after {summary.expiresInDays} days.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <Clock className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xl font-bold">{summary.totalMinutes}m</p>
            <p className="text-[11px] text-muted-foreground">watched recently</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <Eye className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xl font-bold">{summary.seenCount}</p>
            <p className="text-[11px] text-muted-foreground">shorts seen (won't repeat soon)</p>
          </div>
        </div>

        <section className="mt-5 rounded-3xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold">Channels you like most</h2>
          {top.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Watch a few Shorts and your taste will show up here.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {top.map((channel) => (
                <div key={channel.name}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{channel.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {Math.round(channel.watchMs / 60000)}m · {channel.likes} likes
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-primary"
                      style={{ width: `${Math.max(6, (Math.max(0, channel.score) / max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <button
          onClick={() => { clearContext(); setSummary(contextSummary()); toast.success("Feed brain reset"); }}
          className="mt-5 flex items-center gap-2 rounded-full border border-destructive/40 px-5 py-2 text-sm font-semibold text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Reset my feed brain
        </button>
      </div>
    </AppLayout>
  );
}
