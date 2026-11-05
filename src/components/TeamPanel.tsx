import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Row = { id: string; user_id: string; display_name: string };

/** Owner-only: create worker logins (moderator role) and remove them. */
export function TeamPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [datingOn, setDatingOn] = useState(true);

  async function load() {
    const { data } = await supabase.from("user_roles").select("id, user_id").eq("role", "moderator");
    const ids = (data ?? []).map((r) => r.user_id);
    const { data: profs } = ids.length
      ? await supabase.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string }[] };
    setRows((data ?? []).map((r) => ({ ...r, display_name: profs?.find((p) => p.id === r.user_id)?.display_name ?? r.user_id.slice(0, 8) })));
    const { data: s } = await supabase.from("app_settings").select("value").eq("key", "dating_enabled").maybeSingle();
    setDatingOn(s ? s.value !== false : true);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!email || password.length < 8) return toast.error("Email and a password of 8+ characters needed");
    setBusy(true);
    try {
      // Separate client so the owner stays signed in.
      const temp = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, storageKey: "worker-signup" },
      });
      const { data, error } = await temp.auth.signUp({ email, password, options: { data: { display_name: name || email.split("@")[0] } } });
      if (error) throw error;
      const uid = data.user?.id;
      if (!uid) throw new Error("Could not create login");
      const { error: e2 } = await supabase.from("user_roles").insert({ user_id: uid, role: "moderator" });
      if (e2) throw e2;
      toast.success(`Worker created. Login: goasocial.in/auth → then goasocial.in/admin`);
      setEmail(""); setPassword(""); setName("");
      load();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm("Remove this worker's dashboard access?")) return;
    await supabase.from("user_roles").delete().eq("id", id);
    load();
  }

  async function toggleDating() {
    const next = !datingOn;
    const { error } = await supabase.from("app_settings").upsert({ key: "dating_enabled", value: next });
    if (error) return toast.error(error.message);
    setDatingOn(next);
    toast.success(next ? "Goan Dating is on" : "Goan Dating is paused");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Goan Dating</h2>
        <p className="text-sm text-muted-foreground">Turn the /dating page on or off for everyone.</p>
        <button onClick={toggleDating} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {datingOn ? "On — tap to pause" : "Paused — tap to turn on"}
        </button>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Create worker login</h2>
        <p className="text-sm text-muted-foreground">Workers sign in at goasocial.in/auth and open goasocial.in/admin. They can manage events, businesses, sources, YouTube channels and users — not this Team page.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Email (login)" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Password (8+)" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button disabled={busy} onClick={create} className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {busy ? "Creating…" : "Create worker"}
        </button>
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-bold">Workers</h2>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No workers yet.</p> : rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
            <span>{r.display_name}</span>
            <button onClick={() => remove(r.id)} className="text-destructive">Remove</button>
          </div>
        ))}
      </section>
    </div>
  );
}
