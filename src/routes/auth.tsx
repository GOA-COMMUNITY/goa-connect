import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Goa Social" },
      { name: "description", content: "Sign in or create your Goa Social account." },
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

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState(""); // email or 10-digit phone
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [userType, setUserType] = useState<"goan" | "tourist">("goan");
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name:
                name.trim() ||
                (isPhone(raw) ? `Goan ${raw.slice(-4)}` : email.split("@")[0]),
              is_tourist: userType === "tourist",
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
            .update({ is_tourist: userType === "tourist", is_goan: userType === "goan" })
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


  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
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
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUserType("goan")}
                  className={`rounded-2xl border-2 p-3 text-sm font-semibold transition ${
                    userType === "goan"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  🌴 Goan<br /><span className="text-[10px] font-normal opacity-80">Free</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("tourist")}
                  className={`rounded-2xl border-2 p-3 text-sm font-semibold transition ${
                    userType === "tourist"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  🧳 Tourist<br /><span className="text-[10px] font-normal opacity-80">Verification later</span>
                </button>
              </div>
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
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
            required
            minLength={6}
          />
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

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-background py-3 text-sm font-semibold text-foreground transition hover:bg-secondary"
        >
          <svg className="h-4 w-4" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.1 18.9 14 24 14c3 0 5.8 1.1 7.9 3l5.7-5.7C34 8 29.3 6 24 6 16.3 6 9.6 10.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.4 4.4-4.5 5.6l6.2 5.2C40.9 35.8 44 30.4 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          Tip: you can sign in with a 10-digit phone number — no OTP needed.
        </p>
      </div>
    </div>
  );
}
