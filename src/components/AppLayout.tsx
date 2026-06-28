import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, Store, MessageCircle, User, Bell, Search, Shield } from "lucide-react";
import { EventBanner } from "./EventBanner";
import { useAuth } from "@/hooks/use-auth";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/business", label: "Business", icon: Store },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-md shadow-soft">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-11 w-11 overflow-hidden rounded-2xl border border-border">
              <img src="/logo.png" alt="Goa Social" className="h-full w-full object-cover" />
            </div>
            <span className="text-xl font-bold tracking-tight text-primary">Goa Social</span>
          </Link>
          <div className="flex items-center gap-4 text-muted-foreground">
            {isAdmin && (
              <Link to="/admin" className="rounded-full bg-primary/10 p-1.5 text-primary" title="Admin">
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Search className="h-5 w-5" />
            <Bell className="h-5 w-5" />
          </div>
        </div>
      </header>

      <EventBanner />

      <main className="mx-auto max-w-2xl">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-3 py-2 pb-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 rounded-2xl px-4 py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? "stroke-[2.5]" : ""}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
