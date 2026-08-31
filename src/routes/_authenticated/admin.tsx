import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getChannelInfo, type ChannelInfo } from "@/lib/youtube.functions";
import { toast } from "sonner";
import {
  Shield, Users, Store, MessageCircle, Bot, Settings, Trash2,
  ToggleLeft, ToggleRight, ArrowLeft, Search, Youtube, Plus,
  BarChart3, Eye, Heart, Share2, Timer,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Goa Social" },
      { name: "description", content: "Goa Social admin controls for profiles, bots, businesses, and content." },
      { property: "og:title", content: "Admin — Goa Social" },
      { property: "og:description", content: "Goa Social admin controls for profiles, bots, businesses, and content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

type Tab = "overview" | "algorithm" | "users" | "bots" | "businesses" | "content" | "channels";

type Profile = {
  id: string;
  display_name: string;
  area: string | null;
  is_goan: boolean;
  is_tourist: boolean;
  is_fake: boolean;
  is_active: boolean;
  origin_city: string | null;
  personality: string | null;
  language_style: string | null;
  backstory: string | null;
  reply_delay_pattern: string | null;
  avatar_emoji: string | null;
};

function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <Shield className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold">Admin only</h1>
        <p className="text-sm text-muted-foreground">
          You're signed in as {user?.email ?? "guest"} but you don't have admin access.
        </p>
        <Link to="/" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/40">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-full p-2 hover:bg-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Shield className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold">Admin Console</h1>
              <p className="text-[11px] text-muted-foreground">Goa Social control room</p>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {user.email}
          </span>
        </div>
        <nav className="scrollbar-hide mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {([
            ["overview", "Overview", Settings],
            ["algorithm", "Algorithm", BarChart3],
            ["users", "Real Users", Users],
            ["bots", "Demo Profiles", Bot],
            ["businesses", "Businesses", Store],
            ["channels", "YouTube", Youtube],
            ["content", "Site Content", MessageCircle],
          ] as const).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                tab === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "overview" && <OverviewPanel />}
        {tab === "algorithm" && <AlgorithmPanel />}
        {tab === "users" && <ProfilesPanel onlyFake={false} />}
        {tab === "bots" && <ProfilesPanel onlyFake={true} />}
        {tab === "businesses" && <BusinessesPanel />}
        {tab === "channels" && <ChannelsPanel />}
        {tab === "content" && <ContentPanel />}
      </main>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type EventRow = {
  video_id: string;
  source: string;
  kind: string;
  watch_ms: number;
  user_id: string | null;
  created_at: string;
};

function AlgorithmPanel() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("short_events")
      .select("video_id,source,kind,watch_ms,user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data as EventRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  const summarize = (source: "youtube" | "upload") => {
    const events = rows.filter((row) => row.source === source);
    const count = (kind: string) => events.filter((row) => row.kind === kind).length;
    const watched = events.filter((row) => row.kind === "watch" || row.kind === "complete");
    const watchMs = watched.reduce((sum, row) => sum + row.watch_ms, 0);
    const viewers = new Set(events.map((row) => row.user_id).filter(Boolean)).size;
    const engagement = count("like") + count("comment") + count("share") + count("complete");
    const views = count("view");
    return {
      events,
      views,
      likes: count("like"),
      shares: count("share"),
      viewers,
      avgWatch: watched.length ? Math.round(watchMs / watched.length / 1000) : 0,
      engagementRate: views ? Math.round((engagement / views) * 100) : 0,
    };
  };

  if (loading) return <div className="flex justify-center py-16"><span className="text-sm text-muted-foreground">Loading algorithm signals…</span></div>;

  const sources = [
    { key: "youtube" as const, title: "Daily downloaded pool", hint: "Rotating YouTube downloads" },
    { key: "upload" as const, title: "Goa Social originals", hint: "Permanent member uploads" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Algorithm Engine</h2>
        <p className="mt-1 text-sm text-muted-foreground">Latest 5,000 real playback and engagement signals, separated by content source.</p>
      </div>
      {sources.map((source) => {
        const stats = summarize(source.key);
        return (
          <section key={source.key} className="space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">{source.title}</h3>
              <p className="text-xs text-muted-foreground">{source.hint}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric icon={Eye} label="Views" value={stats.views} />
              <Metric icon={Heart} label="Likes" value={stats.likes} />
              <Metric icon={Share2} label="Shares" value={stats.shares} />
              <Metric icon={Timer} label="Avg. watch" value={`${stats.avgWatch}s`} />
              <Metric icon={BarChart3} label="Engagement" value={`${stats.engagementRate}%`} hint={`${stats.viewers} signed-in viewers`} />
            </div>
          </section>
        );
      })}
      {rows.length === 0 && <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Signals will appear as people watch and interact with Shorts.</div>}
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OverviewPanel() {
  const [stats, setStats] = useState({ real: 0, fake: 0, goan: 0, tourist: 0, biz: 0, convs: 0 });
  useEffect(() => {
    (async () => {
      const [real, fake, goan, tourist, biz, convs] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_fake", false),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_fake", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_goan", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_tourist", true),
        supabase.from("businesses").select("id", { count: "exact", head: true }),
        supabase.from("conversations").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        real: real.count ?? 0,
        fake: fake.count ?? 0,
        goan: goan.count ?? 0,
        tourist: tourist.count ?? 0,
        biz: biz.count ?? 0,
        convs: convs.count ?? 0,
      });
    })();
  }, []);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <StatCard label="Real users" value={stats.real} />
      <StatCard label="Demo profiles" value={stats.fake} hint="Seeded community" />
      <StatCard label="Goans" value={stats.goan} />
      <StatCard label="Tourists" value={stats.tourist} />
      <StatCard label="Businesses" value={stats.biz} />
      <StatCard label="Conversations" value={stats.convs} />
    </div>
  );
}

function ProfilesPanel({ onlyFake }: { onlyFake: boolean }) {
  const [rows, setRows] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);

  async function reload() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_fake", onlyFake)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as Profile[]) ?? []);
  }
  useEffect(() => { reload(); }, [onlyFake]);

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.display_name?.toLowerCase().includes(q.toLowerCase()) ||
      r.area?.toLowerCase().includes(q.toLowerCase()) ||
      r.origin_city?.toLowerCase().includes(q.toLowerCase())
  );

  async function toggleActive(p: Profile) {
    const { error } = await supabase.from("profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_active ? "Deactivated" : "Activated");
    reload();
  }

  async function remove(p: Profile) {
    if (!confirm(`Delete ${p.display_name}?`)) return;
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    reload();
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, area, city…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <span className="rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {filtered.length} of {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Profile</th>
              <th className="p-3 text-left">Type</th>
              <th className="p-3 text-left">From</th>
              <th className="p-3 text-left">Personality</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.avatar_emoji ?? "👤"}</span>
                    <div>
                      <p className="font-semibold">{p.display_name}</p>
                      <p className="text-[11px] text-muted-foreground">{p.area}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  {p.is_goan && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Goan</span>}
                  {p.is_tourist && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Tourist</span>}
                  {p.is_fake && <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">🤖 Demo</span>}
                </td>
                <td className="p-3 text-muted-foreground">{p.origin_city ?? "—"}</td>
                <td className="p-3 max-w-[280px] truncate text-muted-foreground" title={p.personality ?? ""}>
                  {p.personality ?? "—"}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setEditing(p)} className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">Edit</button>
                    <button onClick={() => toggleActive(p)} className="rounded-full p-1.5 hover:bg-secondary" title="Toggle active">
                      {p.is_active ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                    </button>
                    <button onClick={() => remove(p)} className="rounded-full p-1.5 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No profiles</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditProfileModal
          profile={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function EditProfileModal({
  profile, onClose, onSaved,
}: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState(profile);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      display_name: p.display_name, area: p.area, origin_city: p.origin_city,
      is_goan: p.is_goan, is_tourist: p.is_tourist, is_active: p.is_active,
      personality: p.personality, language_style: p.language_style,
      backstory: p.backstory, reply_delay_pattern: p.reply_delay_pattern,
      avatar_emoji: p.avatar_emoji,
    }).eq("id", p.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }
  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 md:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl">
        <h2 className="mb-3 text-lg font-bold">Edit profile</h2>
        <div className="space-y-2">
          <label className="text-xs font-semibold">Name</label>
          <input className={field} value={p.display_name ?? ""} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-semibold">Area</label><input className={field} value={p.area ?? ""} onChange={(e) => setP({ ...p, area: e.target.value })} /></div>
            <div><label className="text-xs font-semibold">Origin city</label><input className={field} value={p.origin_city ?? ""} onChange={(e) => setP({ ...p, origin_city: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-semibold">Emoji</label><input className={field} value={p.avatar_emoji ?? ""} onChange={(e) => setP({ ...p, avatar_emoji: e.target.value })} /></div>
            <div><label className="text-xs font-semibold">Reply delay</label><input className={field} value={p.reply_delay_pattern ?? ""} onChange={(e) => setP({ ...p, reply_delay_pattern: e.target.value })} /></div>
          </div>
          <label className="text-xs font-semibold">Personality</label>
          <textarea className={field} rows={2} value={p.personality ?? ""} onChange={(e) => setP({ ...p, personality: e.target.value })} />
          <label className="text-xs font-semibold">Language style</label>
          <textarea className={field} rows={2} value={p.language_style ?? ""} onChange={(e) => setP({ ...p, language_style: e.target.value })} />
          <label className="text-xs font-semibold">Backstory</label>
          <textarea className={field} rows={3} value={p.backstory ?? ""} onChange={(e) => setP({ ...p, backstory: e.target.value })} />
          <div className="flex gap-3 pt-2">
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.is_goan} onChange={(e) => setP({ ...p, is_goan: e.target.checked })} /> Goan</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.is_tourist} onChange={(e) => setP({ ...p, is_tourist: e.target.checked })} /> Tourist</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.is_active} onChange={(e) => setP({ ...p, is_active: e.target.checked })} /> Active</label>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function BusinessesPanel() {
  const [rows, setRows] = useState<{ id: string; name: string; category: string | null; area: string | null; rating: number | null }[]>([]);
  useEffect(() => {
    supabase.from("businesses").select("id,name,category,area,rating").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  async function remove(id: string) {
    if (!confirm("Delete this business?")) return;
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-xs uppercase text-muted-foreground">
          <tr><th className="p-3 text-left">Name</th><th className="p-3 text-left">Category</th><th className="p-3 text-left">Area</th><th className="p-3 text-left">Rating</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-border">
              <td className="p-3 font-semibold">{b.name}</td>
              <td className="p-3 text-muted-foreground">{b.category ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{b.area ?? "—"}</td>
              <td className="p-3">{b.rating ?? 0}</td>
              <td className="p-3 text-right">
                <button onClick={() => remove(b.id)} className="rounded-full p-1.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No businesses yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ContentPanel() {
  const [hero, setHero] = useState<{ title: string; subtitle: string }>({ title: "", subtitle: "" });
  const [videos, setVideos] = useState<string>("");
  useEffect(() => {
    supabase.from("site_content").select("*").then(({ data }) => {
      const h = data?.find((d) => d.key === "hero_text")?.value as { title: string; subtitle: string } | undefined;
      const v = data?.find((d) => d.key === "featured_videos")?.value as string[] | undefined;
      if (h) setHero(h);
      if (v) setVideos(v.join("\n"));
    });
  }, []);
  async function save() {
    const ids = videos.split("\n").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from("site_content").upsert([
      { key: "hero_text", value: hero, updated_at: new Date().toISOString() },
      { key: "featured_videos", value: ids, updated_at: new Date().toISOString() },
    ]);
    if (error) return toast.error(error.message);
    toast.success("Site content saved");
  }
  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-lg font-bold">Homepage content</h2>
      <div>
        <label className="text-xs font-semibold">Hero title</label>
        <input className={field} value={hero.title} onChange={(e) => setHero({ ...hero, title: e.target.value })} />
      </div>
      <div>
        <label className="text-xs font-semibold">Hero subtitle</label>
        <input className={field} value={hero.subtitle} onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} />
      </div>
      <div>
        <label className="text-xs font-semibold">Featured YouTube IDs (one per line)</label>
        <textarea className={field} rows={6} value={videos} onChange={(e) => setVideos(e.target.value)} />
      </div>
      <button onClick={save} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
        Save changes
      </button>
    </div>
  );
}

type Channel = {
  id: string; name: string; url: string; icon: string | null;
  priority: number; active: boolean; weight: number;
  avatar_url: string | null; subscribers: string | null; description: string | null;
};

type Preview = ChannelInfo & { weight: number; duplicate: boolean };

function ChannelsPanel() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [draft, setDraft] = useState({ name: "", url: "", icon: "🌴", priority: 100 });
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const lookup = useServerFn(getChannelInfo);

  function parseChannelLine(line: string) {
    let url = line.trim().replace(/[<>"']/g, "");
    if (!url) return null;
    if (!/^https?:/i.test(url)) {
      url = url.startsWith("@")
        ? `https://www.youtube.com/${url}`
        : `https://www.youtube.com/${url.replace(/^\/+/, "")}`;
    }
    url = url.split("?")[0].replace(/\/(shorts|videos|featured|streams)\/?$/i, "").replace(/\/$/, "");
    const handle = url.match(/@([^/]+)/)?.[1];
    const slug = handle ?? url.split("/").filter(Boolean).pop() ?? "Channel";
    const name = slug
      .replace(/[-_.]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .slice(0, 60);
    return { name, url: `${url}/shorts` };
  }

  /** Paste 50 links -> save them all at once, no lookup, no confirmation. */
  async function addPastedInstantly() {
    const parsed = paste
      .split(/[\n,\s]+/)
      .map(parseChannelLine)
      .filter(Boolean) as { name: string; url: string }[];
    if (!parsed.length) return toast.error("No valid channel links found");

    const existing = new Set(rows.map((r) => r.url.toLowerCase()));
    const seen = new Set<string>();
    const fresh = parsed.filter((p) => {
      const key = p.url.toLowerCase();
      if (existing.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!fresh.length) return toast.info("Those channels are already added");

    setBusy(true);
    const base = rows.length ? Math.max(...rows.map((r) => r.priority ?? 100)) : 0;
    const { error } = await supabase.from("youtube_channels").insert(
      fresh.map((p, i) => ({
        name: p.name, url: p.url, icon: "🌴",
        priority: base + i + 1, active: true, weight: 10,
      })),
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Saved ${fresh.length} channel${fresh.length > 1 ? "s" : ""} to the download list`);
    setPaste("");
    setPreviews([]);
    reload();
  }

  /** Step 1 — look up public details for every pasted link. */
  async function checkPasted() {
    const parsed = paste
      .split(/[\n,\s]+/)
      .map(parseChannelLine)
      .filter(Boolean) as { name: string; url: string }[];
    if (!parsed.length) return toast.error("No valid channel links found");
    setBusy(true);
    const existing = new Set(rows.map((r) => r.url.toLowerCase()));
    const results = await Promise.all(
      parsed.map(async (p) => {
        const info = await lookup({ data: { url: p.url } }).catch(() => null);
        const base: ChannelInfo = info ?? {
          url: p.url, name: p.name, avatarUrl: null, subscribers: null,
          description: null, latestShorts: 0, ok: false,
        };
        return { ...base, weight: 10, duplicate: existing.has(base.url.toLowerCase()) };
      }),
    );
    setBusy(false);
    setPreviews(results);
  }

  /** Step 2 — save the confirmed channels with their share percentage. */
  async function savePreviews() {
    const fresh = previews.filter((p) => !p.duplicate);
    if (!fresh.length) return toast.info("Those channels are already added");
    setBusy(true);
    const base = rows.length ? Math.max(...rows.map((r) => r.priority ?? 100)) : 0;
    const { error } = await supabase.from("youtube_channels").insert(
      fresh.map((p, i) => ({
        name: p.name, url: p.url, icon: "🌴",
        priority: base + i + 1, active: true, weight: p.weight,
        avatar_url: p.avatarUrl, subscribers: p.subscribers, description: p.description,
      })),
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${fresh.length} channel${fresh.length > 1 ? "s" : ""}`);
    setPaste("");
    setPreviews([]);
    reload();
  }



  async function reload() {
    const { data } = await supabase
      .from("youtube_channels")
      .select("*")
      .order("priority", { ascending: true });
    setRows((data as Channel[]) ?? []);
  }
  useEffect(() => { reload(); }, []);

  async function add() {
    if (!draft.name.trim() || !draft.url.trim()) return toast.error("Name and URL required");
    setBusy(true);
    const { error } = await supabase.from("youtube_channels").insert({
      name: draft.name.trim(), url: draft.url.trim(),
      icon: draft.icon || "🌴", priority: Number(draft.priority) || 100,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Channel added — refresh runs every 30 min via GitHub Action");
    setDraft({ name: "", url: "", icon: "🌴", priority: 100 });
    reload();
  }

  async function updateRow(id: string, patch: Partial<Channel>) {
    const { error } = await supabase.from("youtube_channels").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Remove this channel from the scraper?")) return;
    const { error } = await supabase.from("youtube_channels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    reload();
  }

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

  return (
    <div className="space-y-4">
      <ShortsSettingsPanel />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-1 text-lg font-bold">Paste channel links</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Paste one or more YouTube channel links (any format — @handle, /channel/…, /c/…), one per line.
          We fetch the channel details first so you can confirm, and set how big a share of the daily
          100 downloads each channel gets.
        </p>
        <textarea
          className={`${field} font-mono`}
          rows={4}
          placeholder={"https://www.youtube.com/@goanchannel\nhttps://youtube.com/@another/shorts"}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={checkPasted}
            disabled={busy || !paste.trim()}
            className="flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {busy ? "Checking…" : "Check channels"}
          </button>
          <button
            onClick={addPastedInstantly}
            disabled={busy || !paste.trim()}
            className="flex items-center gap-1 rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add all instantly
          </button>
        </div>

        {previews.length > 0 && (
          <div className="mt-4 space-y-3">
            {previews.map((p, i) => (
              <div key={p.url} className="flex gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
                {p.avatarUrl
                  ? <img src={p.avatarUrl} alt={`${p.name} channel avatar`} loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg">🌴</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[p.subscribers, `${p.latestShorts} recent shorts found`, p.duplicate ? "already added" : null]
                      .filter(Boolean).join(" · ")}
                  </p>
                  {p.description && <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Share</span>
                    <input
                      type="range" min={1} max={100} value={p.weight}
                      onChange={(e) => setPreviews(previews.map((x, xi) =>
                        xi === i ? { ...x, weight: Number(e.target.value) } : x))}
                      className="h-1 flex-1 accent-primary"
                    />
                    <span className="w-10 text-right text-[11px] font-semibold">{p.weight}%</span>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={savePreviews}
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add {previews.filter((p) => !p.duplicate).length} channel(s)
            </button>
          </div>
        )}
      </div>



      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-1 text-lg font-bold">YouTube channels</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Latest Shorts from these channels are pulled automatically every 30 minutes.
          Lower priority number = shows first in the feed.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_80px_100px_auto]">
          <input className={field} placeholder="Channel name" value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className={field} placeholder="https://youtube.com/@handle/shorts" value={draft.url}
            onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <input className={field} placeholder="Icon" value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
          <input className={field} type="number" placeholder="Priority" value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
          <button onClick={add} disabled={busy}
            className="flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Channel</th>
              <th className="p-3 text-left">URL</th>
              <th className="p-3 text-left">Share</th>
              <th className="p-3 text-left">Priority</th>
              <th className="p-3 text-left">Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const totalWeight = rows.filter((r) => r.active).reduce((sum, r) => sum + (r.weight || 10), 0) || 1;
              const share = c.active ? Math.round(((c.weight || 10) / totalWeight) * 100) : 0;
              return (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3">
                  {c.avatar_url
                    ? <img src={c.avatar_url} alt={`${c.name} avatar`} loading="lazy"
                        className="mr-2 inline-block h-7 w-7 rounded-full object-cover align-middle" />
                    : <span className="mr-2 text-lg">{c.icon ?? "🌴"}</span>}
                  <span className="font-semibold">{c.name}</span>
                  {c.subscribers && <p className="text-[11px] text-muted-foreground">{c.subscribers}</p>}
                </td>
                <td className="max-w-[280px] truncate p-3 text-xs text-muted-foreground" title={c.url}>{c.url}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} max={100} defaultValue={c.weight ?? 10}
                      onBlur={(e) => updateRow(c.id, { weight: Number(e.target.value) || 10 })}
                      className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                    <span className="text-[11px] text-muted-foreground">≈{share}%</span>
                  </div>
                </td>
                <td className="p-3">
                  <input type="number" defaultValue={c.priority}
                    onBlur={(e) => updateRow(c.id, { priority: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm" />
                </td>
                <td className="p-3">
                  <button onClick={() => updateRow(c.id, { active: !c.active })}>
                    {c.active
                      ? <ToggleRight className="h-5 w-5 text-primary" />
                      : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => remove(c.id)}
                    className="rounded-full p-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No channels yet</td></tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}

type ShortsSettings = {
  cachedFirst: boolean; autoRefresh: boolean; maxCached: number;
  refreshDays: number; perChannel: number; embedsEnabled: boolean;
};

function ShortsSettingsPanel() {
  const [s, setS] = useState<ShortsSettings>({ cachedFirst: true, autoRefresh: true, maxCached: 100, refreshDays: 1, perChannel: 0, embedsEnabled: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "shorts").maybeSingle()
      .then(({ data }) => { if (data?.value) setS({ ...s, ...(data.value as ShortsSettings) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(next: ShortsSettings) {
    setS(next);
    setSaving(true);
    const { error } = await supabase.from("app_settings")
      .upsert({ key: "shorts", value: next, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Shorts settings saved");
  }

  const Row = ({ label, hint, on, onToggle }: { label: string; hint: string; on: boolean; onToggle: () => void }) => (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/60 px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <button onClick={onToggle} aria-label={label}>
        {on ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
      </button>
    </div>
  );

  return (
    <div className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
      <h2 className="text-lg font-bold">Shorts engine</h2>
      <Row
        label="YouTube live-frame shorts"
        hint="Off = the feed plays only the shorts downloaded onto Goa Social hosting."
        on={s.embedsEnabled}
        onToggle={() => save({ ...s, embedsEnabled: !s.embedsEnabled })}
      />
      <Row
        label="Play pre-cached shorts first"
        hint="First clips stream from our own hosting for an instant start."
        on={s.cachedFirst}
        onToggle={() => save({ ...s, cachedFirst: !s.cachedFirst })}
      />
      <Row
        label="Auto-refresh latest shorts"
        hint="Pull the newest Shorts from your channels every 30 minutes."
        on={s.autoRefresh}
        onToggle={() => save({ ...s, autoRefresh: !s.autoRefresh })}
      />
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Downloaded shorts per day</p>
          <p className="text-[11px] text-muted-foreground">
            Rebuilt every day from the newest shorts across your channels. Old clips are deleted only
            after the new pool is verified.
          </p>
        </div>
        <input
          type="number" min={0} max={300} value={s.maxCached}
          onChange={(e) => setS({ ...s, maxCached: Number(e.target.value) })}
          onBlur={() => save(s)}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Rebuild every … days</p>
          <p className="text-[11px] text-muted-foreground">
            1 = a brand-new set of latest shorts every day, 2 = every second day. In between, runs
            only top the pool up.
          </p>
        </div>
        <input
          type="number" min={1} max={14} value={s.refreshDays}
          onChange={(e) => setS({ ...s, refreshDays: Number(e.target.value) })}
          onBlur={() => save(s)}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/60 px-4 py-3">
        <div>
          <p className="text-sm font-semibold">Max shorts per channel</p>
          <p className="text-[11px] text-muted-foreground">
            Cap how many clips a single channel can contribute each cycle. 0 = automatic from the
            share sliders.
          </p>
        </div>
        <input
          type="number" min={0} max={100} value={s.perChannel}
          onChange={(e) => setS({ ...s, perChannel: Number(e.target.value) })}
          onBlur={() => save(s)}
          className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm"
        />
      </div>

      {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
    </div>
  );
}
