import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Goa Social" },
      { name: "description", content: "Sign in or create your Goa Social account." },
      { property: "og:title", content: "Sign in — Goa Social" },
      { property: "og:description", content: "Sign in or create your Goa Social account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

// Phone IDs are mapped to a synthetic email so Supabase email auth works
// without SMS/OTP. Format: <10-digits>@goa.social
function phoneToEmail(phone: string) {
  return `${phone.trim()}@goa.social`;
}
function isPhone(v: string) {
  return /^\d{10}$/.test(v.trim());
}

const BIZ_CATEGORIES = ["Cafe", "Restaurant", "Bar", "Surf School", "Hotel", "Shop", "Art", "Service", "Other"];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState(""); // email or 10-digit phone
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business">("personal");
  const [bizName, setBizName] = useState("");
  const [bizCategory, setBizCategory] = useState("Cafe");
  const [isTourist, setIsTourist] = useState<boolean | null>(null);
  const [originCity, setOriginCity] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const raw = identifier.trim();
      const email = isPhone(raw) ? phoneToEmail(raw) : raw.toLowerCase();

      if (mode === "signup") {
        if (accountType === "personal" && isTourist === null) {
          toast.error("Tap Goan or Tourist so people know who you are.");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name:
                (accountType === "business" ? bizName.trim() : "") ||
                name.trim() ||
                (isPhone(raw) ? `Goan ${raw.slice(-4)}` : email.split("@")[0]),
              account_type: accountType,
              business_name: accountType === "business" ? bizName.trim() : "",
              business_category: accountType === "business" ? bizCategory : "",
              is_tourist: accountType === "personal" && isTourist ? "true" : "false",
              origin_city: accountType === "personal" && isTourist ? originCity.trim() : "",
            },
            emailRedirectTo: window.location.origin,
          },
        });

        if (error) {
          // Common: "User already registered" -> guide them to sign in
          if (/already/i.test(error.message)) {
            toast.error("Account exists — try signing in instead.");
            setMode("signin");
          } else {
            toast.error(error.message);
          }
          return;
        }

        // Try to sign in immediately (works when email confirmation is off)
        const { data: signInData, error: signInErr } =
          await supabase.auth.signInWithPassword({ email, password });

        if (signInErr || !signInData.session) {
          toast.success("Account created! Please check your email to confirm, then sign in.");
          setMode("signin");
          return;
        }

        // Best-effort profile flags — ignore RLS errors, trigger already created row
        if (data.user) {
          supabase
            .from("profiles")
            .update({
              account_type: accountType,
              business_name: accountType === "business" ? bizName.trim() : null,
              business_category: accountType === "business" ? bizCategory : null,
              is_goan: accountType === "personal" ? isTourist !== true : false,
              is_tourist: accountType === "personal" && isTourist === true,
              origin_city: accountType === "personal" && isTourist ? originCity.trim() || null : null,
            })
            .eq("id", data.user.id)
            .then(() => {});
        }

        toast.success("Welcome to Goa Social!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message === "Invalid login credentials"
            ? "Wrong email/phone or password."
            : error.message);
          return;
        }
        toast.success("Welcome back!");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }


  // One-tap guest account: name only, no email, no password, no verification.
  async function handleInstant() {
    if (busy) return;
    if (!name.trim()) {
      toast.error("Please enter your name first.");
      return;
    }
    if (accountType === "business" && !bizName.trim()) {
      toast.error("Please enter your business name first.");
      return;
    }
    if (accountType === "personal" && isTourist === null) {
      toast.error("Tap Goan or Tourist so people know who you are.");
      return;
    }
    setBusy(true);
    try {
      const id = `goan${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
      const pass = crypto.randomUUID().replace(/-/g, "");
      const { error } = await supabase.auth.signUp({
        email: `${id}@goa.social`,
        password: pass,
        options: {
          data: {
            full_name: name.trim() || `Goan ${id.slice(-4)}`,
            account_type: accountType,
            business_name: accountType === "business" ? bizName.trim() : "",
            business_category: accountType === "business" ? bizCategory : "",
            is_tourist: accountType === "personal" && isTourist ? "true" : "false",
            origin_city: accountType === "personal" && isTourist ? originCity.trim() : "",
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }
      const { data: signedIn } = await supabase.auth.signInWithPassword({
        email: `${id}@goa.social`,
        password: pass,
      });
      if (!signedIn.session) {
        toast.error("Could not start your session — try again.");
        return;
      }
      try {
        localStorage.setItem("gs_quick_login", JSON.stringify({ id: `${id}@goa.social`, pass }));
        localStorage.setItem("gs_guest_since", String(Date.now()));
      } catch {}
      toast.success("You're in! Guest accounts are removed after 7 days — add an email in Profile to keep it.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }



  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-blue-50 px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-2xl border border-border">
          <img src="/logo.png" alt="" className="h-full w-full object-cover" />
        </div>
        <span className="text-2xl font-bold text-primary">Goa Social</span>
      </Link>

      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="mb-5 flex rounded-full bg-secondary p-1">
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              mode === "signin" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
              mode === "signup" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["personal", "Personal", "For fun & community", "🌴"],
                  ["business", "Business", "Promote & grow", "🏪"],
                ] as const).map(([value, label, hint, icon]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAccountType(value)}
                    className={`rounded-2xl border-2 p-3 text-left transition ${
                      accountType === value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="ml-2 text-sm font-semibold">{label}</span>
                    <span className="mt-1 block text-[10px] font-normal opacity-80">{hint}</span>
                  </button>
                ))}
              </div>
              {accountType === "personal" && (
                <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-foreground">Are you a Goan or a tourist?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      [false, "Goan", "I live here", "\uD83C\uDF34"],
                      [true, "Tourist", "Just visiting", "\u2708\uFE0F"],
                    ] as const).map(([value, label, hint, icon]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setIsTourist(value)}
                        className={`rounded-xl border-2 p-3 text-left transition ${
                          isTourist === value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <span className="text-base">{icon}</span>
                        <span className="ml-2 text-sm font-semibold">{label}</span>
                        <span className="mt-1 block text-[10px] font-normal opacity-80">{hint}</span>
                      </button>
                    ))}
                  </div>
                  {isTourist === true && (
                    <input
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      placeholder="Where are you from? (city)"
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    />
                  )}
                </div>
              )}
              {accountType === "business" && (
                <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                  <input
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="Business name"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                    required
                  />
                  <select
                    value={bizCategory}
                    onChange={(e) => setBizCategory(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
                  >
                    {BIZ_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">You keep the same social features, with business tools ready when you need them.</p>
                </div>
              )}
            </>
          )}
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Phone (10 digits) or email"
            inputMode="email"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            required
          />
          <div className="flex items-center rounded-2xl border border-border bg-background focus-within:border-primary">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="rounded-2xl border border-border bg-secondary/40 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (required)"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={handleInstant}
            disabled={busy}
            className="gs-press mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-card disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Continue instantly — no email needed
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Guest accounts are deleted after 7 days. Add an email + password in Profile to keep yours forever.
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Tip: you can sign in with a 10-digit phone number — no OTP needed.
        </p>
      </div>
    </div>
  );
}
