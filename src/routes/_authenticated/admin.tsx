import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getChannelInfo, type ChannelInfo } from "@lib/youtube.functions";
import { toast } from "sonner";
import { eventCategories, type GoaEvent } from "@lib/events";
import { importEventsNow } from "@lib/automation.functions";
import {
  fetchChannels, addChannel, updateChannel, removeChannel,
  clearChannelPool, refreshAllChannels, fetchShortsAnalytics,
  type YTChannel,
} from "@/lib/shorts-pool";
import { getShortsSettings, defaultShortsSettings, type ShortsSettings } from "@/lib/app-settings";
import {
  Shield, Users, Store, Bot, Trash2, ArrowLeft, Youtube, Plus,
  BarChart3, Eye, Heart, Share2, Timer, CalendarDays, Pencil, Rss,
  TrendingUp, RefreshCw, Settings2, ToggleLeft, ToggleRight, Loader2,
  Video, Activity, Zap, Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Goa Social" },
      { name: "description", content: "Goa Social admin controls." },
      { property: "og:title", content: "Admin — Goa Social" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

type Tab = "overview" | "channels" | "algorithm" | "analytics" | "users" | "bots" | "businesses" | "events" | "settings";

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
  avatar_emoji: string | null;
};

function AdminDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-bold">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You're signed in as {user?.email ?? "guest"} but you don't have admin access.
          </p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Go home
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "channels", label: "Channels", icon: Youtube },
    { id: "algorithm", label: "Algorithm", icon: Zap },
    { id: "analytics", label: "Analytics", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "bots", label: "Bots", icon: Bot },
    { id: "businesses", label: "Businesses", icon: Store },
    { id: "events", label: "Events", icon: CalendarDays },
    { id: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 gs-glass border-b border-border/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/70">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-display text-lg font-bold leading-none">Admin Console</h1>
              <p className="text-[11px] text-muted-foreground">Goa Social control room</p>
            </div>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Shield className="h-5 w-5" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-4">
        <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                tab === id
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="gs-fade-in" key={tab}>
          {tab === "overview" && <OverviewTab />}
          {tab === "channels" && <ChannelsTab />}
          {tab === "algorithm" && <AlgorithmTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "bots" && <BotsTab />}
          {tab === "businesses" && <BusinessesTab />}
          {tab === "events" && <EventsTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </div>
    </div>
  );
}

/* ── Overview ── */

function OverviewTab() {
  const [analytics, setAnalytics] = useState<Awaited<ReturnType<typeof fetchShortsAnalytics>> | null>(null);
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    void fetchShortsAnalytics().then(setAnalytics);
    void fetchChannels().then(setChannels);
    void supabase.from("profiles").select("*", { count: "exact", head: true }).then(({ count }) => setUserCount(count ?? 0));
  }, []);

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  const fmtTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  };

  const stats = [
    { label: "Total Users", value: fmt(userCount), icon: Users, hint: "Registered profiles" },
    { label: "YT Channels", value: `${channels.length}`, icon: Youtube, hint: `${channels.filter(c => c.is_active).length} active` },
    { label: "Total Views", value: fmt(analytics?.totalViews ?? 0), icon: Eye, hint: "Shorts playbacks" },
    { label: "Total Likes", value: fmt(analytics?.totalLikes ?? 0), icon: Heart, hint: "Like taps" },
    { label: "Shares", value: fmt(analytics?.totalShares ?? 0), icon: Share2, hint: "Share clicks" },
    { label: "Watch Time", value: fmtTime(analytics?.totalWatchMs ?? 0), icon: Timer, hint: "Cumulative" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-soft gs-card-hover">
            <div className="flex items-center justify-between">
              <s.icon className="h-5 w-5 text-primary" />
              <span className="font-display text-2xl font-extrabold tracking-tight">{s.value}</span>
            </div>
            <p className="mt-1 text-sm font-semibold">{s.label}</p>
            <p className="text-[11px] text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {analytics && analytics.byVideo.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold">
            <TrendingUp className="h-4 w-4 text-primary" /> Top Shorts by Views
          </h2>
          <div className="space-y-2">
            {[...analytics.byVideo].sort((a, b) => b.views - a.views).slice(0, 8).map((v) => (
              <div key={v.video_id} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 font-mono text-xs font-semibold">{v.video_id}</span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {v.views}</span>
                  <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {v.likes}</span>
                  <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {v.shares}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Channels Tab ── */

function ChannelsTab() {
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(1);
  const [maxShorts, setMaxShorts] = useState(10);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<ChannelInfo | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(() => { void fetchChannels().then(setChannels); }, []);
  useEffect(() => { load(); }, [load]);

  async function handlePreview() {
    if (!url.trim()) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const info = await getChannelInfo({ data: { url } });
      setPreview(info);
    } catch {
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleAdd() {
    if (!url.trim() || !name.trim()) { toast.error("Enter both URL and name"); return; }
    setAdding(true);
    const ch = await addChannel(url.trim(), name.trim(), weight, maxShorts);
    if (ch) {
      toast.success(`Added "${name}"`);
      setUrl(""); setName(""); setWeight(1); setMaxShorts(10); setPreview(null);
      load();
    } else {
      toast.error("Failed to add channel");
    }
    setAdding(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    const result = await refreshAllChannels();
    if (result.ok) {
      toast.success(result.message + (result.fetched ? ` — ${result.fetched} shorts fetched` : ""));
      load();
    } else {
      toast.error(result.message);
    }
    setRefreshing(false);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-1 font-display text-base font-bold">Add YouTube Channel</h2>
        <p className="mb-4 text-xs text-muted-foreground">Paste a channel URL. Shorts will be auto-fetched from this channel into the feed pool.</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://youtube.com/@adventuregoa"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handlePreview}
              disabled={previewing || !url.trim()}
              className="shrink-0 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary/70 disabled:opacity-50"
            >
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          {preview && (
            <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3 gs-fade-in">
              {preview.avatarUrl && <img src={preview.avatarUrl} alt="" className="h-10 w-10 rounded-full" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{preview.name}</p>
                <p className="truncate text-xs text-muted-foreground">{preview.subscribers ?? "—"} · {preview.latestShorts} shorts found</p>
              </div>
              {preview.ok ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">FOUND</span>
              ) : (
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">FAILED</span>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold">Channel Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Adventure Goa"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Weight (feed priority)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold">Max shorts per refresh</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxShorts}
              onChange={(e) => setMaxShorts(Number(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Channel
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold">Active Channels ({channels.length})</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh All
          </button>
        </div>
        {channels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No channels yet. Add one above to start pulling shorts.
          </p>
        ) : (
          <div className="space-y-3">
            {channels.map((ch) => (
              <ChannelRow key={ch.id} channel={ch} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelRow({ channel, onChanged }: { channel: YTChannel; onChanged: () => void }) {
  const [editWeight, setEditWeight] = useState(false);
  const [w, setW] = useState(channel.weight);
  const [editMax, setEditMax] = useState(false);
  const [m, setM] = useState(channel.max_shorts);

  async function toggle() {
    const ok = await updateChannel(channel.id, { is_active: !channel.is_active });
    if (ok) { toast.success(channel.is_active ? "Paused" : "Activated"); onChanged(); } else toast.error("Failed");
  }
  async function saveW() {
    const ok = await updateChannel(channel.id, { weight: w });
    if (ok) { toast.success("Weight updated"); setEditWeight(false); onChanged(); } else toast.error("Failed");
  }
  async function saveM() {
    const ok = await updateChannel(channel.id, { max_shorts: m });
    if (ok) { toast.success("Max shorts updated"); setEditMax(false); onChanged(); } else toast.error("Failed");
  }
  async function remove() {
    if (!confirm(`Remove "${channel.channel_name}" and all its shorts?`)) return;
    const ok = await removeChannel(channel.id);
    if (ok) { toast.success("Removed"); onChanged(); } else toast.error("Failed");
  }
  async function clearPool() {
    if (!confirm(`Clear all fetched shorts for "${channel.channel_name}"?`)) return;
    const ok = await clearChannelPool(channel.id);
    if (ok) { toast.success("Pool cleared"); onChanged(); } else toast.error("Failed");
  }

  return (
    <div className={`rounded-xl border p-4 transition-colors ${channel.is_active ? "border-border bg-card" : "border-dashed border-border opacity-60"}`}>
      <div className="flex items-start gap-3">
        {channel.avatar_url ? (
          <img src={channel.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-xl">🌴</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{channel.channel_name}</p>
            {channel.channel_handle && <span className="shrink-0 text-xs text-muted-foreground">@{channel.channel_handle}</span>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{channel.channel_url}</p>
          {channel.last_fetched_at && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">Last fetch: {new Date(channel.last_fetched_at).toLocaleString()}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {editWeight ? (
              <span className="flex items-center gap-1">
                <input type="number" min={1} max={10} value={w} onChange={(e) => setW(Number(e.target.value))} className="w-14 rounded-lg border border-input px-2 py-0.5 text-xs" />
                <button onClick={saveW} className="rounded-lg bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Save</button>
              </span>
            ) : (
              <button onClick={() => setEditWeight(true)} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">Weight: {channel.weight}</button>
            )}
            {editMax ? (
              <span className="flex items-center gap-1">
                <input type="number" min={1} max={50} value={m} onChange={(e) => setM(Number(e.target.value))} className="w-14 rounded-lg border border-input px-2 py-0.5 text-xs" />
                <button onClick={saveM} className="rounded-lg bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">Save</button>
              </span>
            ) : (
              <button onClick={() => setEditMax(true)} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">Max: {channel.max_shorts}</button>
            )}
            {channel.subscriber_count && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{channel.subscriber_count}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button onClick={toggle} title={channel.is_active ? "Pause" : "Activate"} className="rounded-lg p-1.5 hover:bg-secondary">
            {channel.is_active ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
          </button>
          <button onClick={clearPool} title="Clear pool" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Rss className="h-4 w-4" />
          </button>
          <button onClick={remove} title="Remove" className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Algorithm Tab ── */

function AlgorithmTab() {
  const [settings, setSettings] = useState<ShortsSettings>(defaultShortsSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { void getShortsSettings().then(setSettings); }, []);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({ key: "shorts", value: settings }, { onConflict: "key" });
    if (error) toast.error("Failed to save"); else toast.success("Algorithm updated");
    setSaving(false);
  }

  const fields: { key: keyof ShortsSettings; label: string; hint: string }[] = [
    { key: "cachedFirst", label: "Cached first", hint: "Show cached shorts before network loads" },
    { key: "autoRefresh", label: "Auto refresh pool", hint: "Automatically fetch new shorts daily" },
    { key: "embedsEnabled", label: "YouTube embeds", hint: "Play YouTube shorts inline (otherwise Goa-hosted only)" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-1 font-display text-base font-bold">Feed Algorithm</h2>
        <p className="mb-4 text-xs text-muted-foreground">Controls how shorts are selected and served to users.</p>

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-xl bg-secondary/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-[11px] text-muted-foreground">{f.hint}</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, [f.key]: !s[f.key] }))}
                className="shrink-0"
              >
                {settings[f.key] ? <ToggleRight className="h-7 w-7 text-primary" /> : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
              </button>
            </div>
          ))}

          <div className="rounded-xl bg-secondary/40 px-4 py-3">
            <label className="mb-1 block text-sm font-semibold">Max cached shorts: {settings.maxCached}</label>
            <input type="range" min={20} max={200} step={10} value={settings.maxCached}
              onChange={(e) => setSettings(s => ({ ...s, maxCached: Number(e.target.value) }))}
              className="w-full accent-primary" />
          </div>
          <div className="rounded-xl bg-secondary/40 px-4 py-3">
            <label className="mb-1 block text-sm font-semibold">Refresh cycle: every {settings.refreshDays} day(s)</label>
            <input type="range" min={1} max={7} step={1} value={settings.refreshDays}
              onChange={(e) => setSettings(s => ({ ...s, refreshDays: Number(e.target.value) }))}
              className="w-full accent-primary" />
          </div>
          <div className="rounded-xl bg-secondary/40 px-4 py-3">
            <label className="mb-1 block text-sm font-semibold">Per-channel limit: {settings.perChannel === 0 ? "Auto" : settings.perChannel}</label>
            <input type="range" min={0} max={30} step={1} value={settings.perChannel}
              onChange={(e) => setSettings(s => ({ ...s, perChannel: Number(e.target.value) }))}
              className="w-full accent-primary" />
            <p className="mt-1 text-[11px] text-muted-foreground">0 = automatic from channel weight</p>
          </div>
        </div>

        <button onClick={save} disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Save Algorithm
        </button>
      </div>
    </div>
  );
}

/* ── Analytics Tab ── */

function AnalyticsTab() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchShortsAnalytics>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchShortsAnalytics().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground">No data</p>;

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
  const totalEvents = data.totalViews + data.totalLikes + data.totalShares + data.totalComments;
  const top = [...data.byVideo].sort((a, b) => b.views - a.views).slice(0, 20);
  const maxViews = Math.max(...top.map(v => v.views), 1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Views" value={fmt(data.totalViews)} icon={Eye} />
        <StatCard label="Likes" value={fmt(data.totalLikes)} icon={Heart} />
        <StatCard label="Shares" value={fmt(data.totalShares)} icon={Share2} />
        <StatCard label="Comments" value={fmt(data.totalComments)} icon={MessageCircle} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 font-display text-base font-bold">Per-Video Breakdown ({top.length} videos)</h2>
        {top.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No shorts events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {top.map((v, i) => (
              <div key={v.video_id} className="rounded-xl bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="font-mono text-xs font-semibold">{v.video_id}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {v.views}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {v.likes}</span>
                    <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> {v.shares}</span>
                    <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {Math.round(v.watch_ms / 1000)}s</span>
                    {v.completes > 0 && <span className="text-green-600">✓{v.completes}</span>}
                    {v.skips > 0 && <span className="text-red-500">↷{v.skips}</span>}
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(v.views / maxViews) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Eye }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 font-display text-xl font-extrabold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

/* ── Users Tab (simplified) ── */
function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    void supabase.from("profiles").select("id, display_name, area, is_goan, is_tourist, is_fake, is_active, origin_city, personality, avatar_emoji").then(({ data }) => setProfiles((data ?? []) as Profile[]));
  }, []);
  const filtered = profiles.filter(p => p.display_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search profiles..."
        className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-soft">
            <span className="text-xl">{p.avatar_emoji ?? "👤"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{p.display_name}</p>
              <p className="text-xs text-muted-foreground">{p.area ?? "—"} · {p.is_goan ? "Goan" : p.is_tourist ? "Tourist" : "Member"}{p.is_fake ? " · 🤖 Demo" : ""}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.is_active ? "ACTIVE" : "INACTIVE"}</span>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No profiles found</p>}
      </div>
    </div>
  );
}

/* ── Bots Tab (placeholder) ── */
function BotsTab() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">Bot management</p>
      <p className="mt-1 text-xs text-muted-foreground">Configure demo profiles and automated engagement from the existing controls.</p>
    </div>
  );
}

/* ── Businesses Tab (placeholder) ── */
function BusinessesTab() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    void supabase.from("businesses").select("*", { count: "exact", head: true }).then(({ count }) => setCount(count ?? 0));
  }, []);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">{count} businesses listed</p>
            <p className="text-xs text-muted-foreground">Manage listings from the Business directory page.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Events Tab (placeholder) ── */
function EventsTab() {
  const [count, setCount] = useState(0);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    void supabase.from("events").select("*", { count: "exact", head: true }).then(({ count }) => setCount(count ?? 0));
  }, []);
  async function doImport() {
    setImporting(true);
    try { await importEventsNow(); toast.success("Events imported"); }
    catch { toast.error("Import failed"); }
    setImporting(false);
  }
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{count} events in database</p>
              <p className="text-xs text-muted-foreground">Published events appear on the Events page.</p>
            </div>
          </div>
          <button onClick={doImport} disabled={importing}
            className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Import
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Settings Tab ── */
function SettingsTab() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <Settings2 className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">App Settings</p>
      <p className="mt-1 text-xs text-muted-foreground">Global app configuration options will appear here.</p>
    </div>
  );
}
