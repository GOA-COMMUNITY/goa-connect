import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Store, MessageCircle, User, Bell, Search, Shield } from "lucide-react";
import { EventBanner } from "./EventBanner";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/business", label: "Business", icon: Store },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppLayout({ children, showEventBanner = true }: { children: ReactNode; showEventBanner?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin, user } = useAuth();
  const isGuest = !!user?.email?.endsWith("@goa.social") && !/^\d{10}@goa\.social$/.test(user.email);

  return (
    <div className="min-h-screen bg-background pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-50 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-lg border border-border">
              <img
                src="/logo.png"
                alt="Goa Social"
                width={40}
                height={40}
                decoding="async"
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">Goa Social</span>
          </Link>

          <div className="flex items-center gap-4 text-muted-foreground">
            {isAdmin && (
              <Link to="/admin" className="rounded-full bg-primary/10 p-1.5 text-primary" title="Admin">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Link to="/explore" className="rounded-full p-1.5" aria-label="Search people">
              <Search className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => toast.info("Notifications are coming soon")}
              className="rounded-full p-1.5"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {isGuest && (
        <Link
          to="/profile"
          className="mx-auto block max-w-2xl px-4 pt-3"
        >
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-medium text-amber-800">
            You're on a guest account — it gets deleted in 7 days. Tap to add your email &amp; keep it forever.
          </div>
        </Link>
      )}

      {showEventBanner && <EventBanner />}

      <main className="mx-auto max-w-2xl">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-3 py-2 pb-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                preload="intent"
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-primary/10" : ""
                  }`}
                >
                  <Icon className={`h-6 w-6 ${active ? "stroke-[2.5]" : ""}`} />
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}
