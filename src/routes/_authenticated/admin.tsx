import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Shield, Users, Store, MessageCircle, Bot, Settings, Trash2,
  ToggleLeft, ToggleRight, ArrowLeft, Search, Youtube, Plus,
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

type Tab = "overview" | "users" | "bots" | "businesses" | "content" | "channels";

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
  priority: number; active: boolean;
};

function ChannelsPanel() {
  const [rows, setRows] = useState<Channel[]>([]);
  const [draft, setDraft] = useState({ name: "", url: "", icon: "🌴", priority: 100 });
  const [busy, setBusy] = useState(false);

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
              <th className="p-3 text-left">Priority</th>
              <th className="p-3 text-left">Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3">
                  <span className="mr-2 text-lg">{c.icon ?? "🌴"}</span>
                  <span className="font-semibold">{c.name}</span>
                </td>
                <td className="max-w-[280px] truncate p-3 text-xs text-muted-foreground" title={c.url}>{c.url}</td>
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
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No channels yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
