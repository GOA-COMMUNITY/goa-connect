import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, History, Settings, HelpCircle, ChevronRight, LogOut, Moon, Sun } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Goa Social" },
      { name: "description", content: "Your Goa Social profile, settings, and saved content." },
      { property: "og:title", content: "Profile — Goa Social" },
      { property: "og:description", content: "Your Goa Social profile, settings, and saved content." },
    ],
  }),
  component: Profile,
});

function Profile() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  const stats = [
    { label: "Posts", value: 0 },
    { label: "Followers", value: 0 },
    { label: "Following", value: 0 },
  ];

  const menu = [
    { icon: Bookmark, label: "Saved Videos" },
    { icon: History, label: "Watch History" },
    { icon: Settings, label: "Settings" },
    { icon: HelpCircle, label: "Help & Support" },
  ];

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-card">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-primary text-3xl font-bold text-primary-foreground shadow-card">
            G
          </div>
          <h2 className="mt-3 text-xl font-bold text-foreground">Guest User</h2>
          <p className="text-sm text-muted-foreground">@goan_explorer</p>
          <div className="mt-5 flex justify-around">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <button className="mt-5 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground">
            Edit Profile
          </button>
        </div>

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
            <button
              key={m.label}
              className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-secondary/60 ${
                i < menu.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <m.icon className="h-5 w-5 text-primary" />
              <span className="flex-1 text-sm font-medium text-foreground">{m.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        <button className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-destructive">
          <LogOut className="h-4 w-4" /> Sign Out
        </button>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          Goa Social · v2.0 · Made with 🥥 in Goa
        </p>
      </div>
    </AppLayout>
  );
}
