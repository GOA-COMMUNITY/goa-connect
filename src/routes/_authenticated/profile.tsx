import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, HelpCircle, ChevronRight, LogOut, Moon, Sun, Loader2, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Goa Social" },
      { name: "description", content: "Manage your Goa Social profile, settings, and legal links." },
      { property: "og:title", content: "Profile — Goa Social" },
      { property: "og:description", content: "Manage your Goa Social profile, settings, and legal links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Profile,
});

const AREAS = ["", "Panjim", "Mapusa", "Margao", "Anjuna", "Assagao", "Calangute", "Vasco", "Ponda", "Other"];
const EMOJIS = ["🌴", "🏖️", "🦐", "🎨", "🎵", "🏄", "☕", "🌅", "🐠", "🥥"];

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [themeReady, setThemeReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ display_name: "", area: "", bio: "", avatar_emoji: "🌴" });

  useEffect(() => {
    const saved = localStorage.getItem("gs_theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    setDark(saved ? saved === "dark" : document.documentElement.classList.contains("dark") || prefersDark);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("gs_theme", dark ? "dark" : "light");
  }, [dark, themeReady]);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["profile-counts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user!.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user!.id),
      ]);
      return { followers: followers.count ?? 0, following: following.count ?? 0 };
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        area: profile.area ?? "",
        bio: profile.bio ?? "",
        avatar_emoji: profile.avatar_emoji ?? "🌴",
      });
    }
  }, [profile]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
    qc.invalidateQueries({ queryKey: ["profiles"] });
    setEditing(false);
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const stats = [
    { label: "Posts", value: 0 },
    { label: "Followers", value: counts?.followers ?? 0 },
    { label: "Following", value: counts?.following ?? 0 },
  ];

  const menu = [
    { icon: ShieldCheck, label: "Privacy Policy", to: "/privacy" as const },
    { icon: FileText, label: "Terms & Conditions", to: "/terms" as const },
    { icon: FileText, label: "Refund Policy", to: "/refunds" as const },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card">
          <div className="mx-auto w-fit rounded-full shadow-card">
            <ProfileAvatar url={profile?.avatar_url} emoji={profile?.avatar_emoji} name={profile?.display_name} className="h-24 w-24" fallbackClassName="text-4xl" />
          </div>
          <h2 className="mt-3 text-xl font-bold text-foreground">
            {isLoading ? "…" : profile?.display_name ?? "Goan"}
          </h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          {profile?.area && <p className="mt-0.5 text-xs text-muted-foreground">📍 {profile.area}</p>}
          {profile?.bio && <p className="mt-2 text-sm text-foreground">{profile.bio}</p>}

          <div className="mt-5 flex justify-around">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            {editing ? "Cancel" : "Edit Profile"}
          </button>
        </div>

        {editing && (
          <div className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-soft">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Display name</label>
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Area</label>
              <select
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>{a || "Select…"}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Bio</label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="mt-1 w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Avatar</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm({ ...form, avatar_emoji: e })}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl ${
                      form.avatar_emoji === e ? "border-primary bg-primary/10" : "border-border bg-background"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        )}

        <button
          onClick={() => setDark((d) => !d)}
          className="flex w-full items-center justify-between rounded-3xl border border-border bg-card p-4 shadow-soft"
        >
          <div className="flex items-center gap-3">
            {dark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            <span className="font-medium text-foreground">{dark ? "Dark Mode" : "Light Mode"}</span>
          </div>
          <div className={`h-6 w-11 rounded-full p-0.5 transition-colors ${dark ? "bg-primary" : "bg-secondary"}`}>
            <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${dark ? "translate-x-5" : ""}`} />
          </div>
        </button>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
          {menu.map((m, i) => (
            <Link
              key={m.label}
              to={m.to}
              className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/60 ${
                i < menu.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <m.icon className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm font-medium text-foreground">{m.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          <a
            href="mailto:support@goasocial.in"
            className="flex w-full items-center gap-3 border-t border-border px-5 py-4 text-left transition-colors hover:bg-secondary/60"
          >
            <HelpCircle className="h-5 w-5 text-primary" />
            <span className="flex-1 text-sm font-medium text-foreground">Help & Support</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>

        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Goa Social · v2.0 · Made with 🥥 in Goa
        </p>
      </div>
    </AppLayout>
  );
}
