import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Star, MapPin, Phone, Plus, Loader2, X, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Goa Business Directory — Goa Social" },
      { name: "description", content: "Discover the best restaurants, cafes, surf schools, and local businesses in Goa." },
    ],
  }),
  component: Business,
});

type Biz = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string | null;
  area: string | null;
  phone: string | null;
  rating: number | null;
};

const CATEGORIES = ["Cafe", "Restaurant", "Bar", "Surf School", "Hotel", "Shop", "Art", "Service", "Other"];
const CATEGORY_EMOJI: Record<string, string> = {
  Cafe: "☕",
  Restaurant: "🦐",
  Bar: "🍹",
  "Surf School": "🏄",
  Hotel: "🏨",
  Shop: "🛍️",
  Art: "🎨",
  Service: "🛠️",
  Other: "🌴",
};

function Business() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Biz[];
    },
  });

  function openList() {
    if (!user) return navigate({ to: "/auth" });
    setOpen(true);
  }

  return (
    <AppLayout>
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Goa Directory</h1>
            <p className="text-sm text-muted-foreground">Hand-picked local businesses</p>
          </div>
          <button
            onClick={openList}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <Plus className="h-4 w-4" /> List
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && businesses.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No businesses listed yet.</p>
            <button onClick={openList} className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
              List your business
            </button>
          </div>
        )}

        {businesses.map((b) => (
          <article key={b.id} className="overflow-hidden rounded-3xl border border-border bg-card shadow-card">
            <div className="relative h-32 bg-gradient-primary">
              <div className="absolute right-4 top-4 text-5xl opacity-90 drop-shadow-sm">
                {CATEGORY_EMOJI[b.category ?? "Other"] ?? "🌴"}
              </div>
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <h3 className="text-xl font-bold drop-shadow">{b.name}</h3>
                {b.rating != null && b.rating > 0 && (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                    <Star className="h-3 w-3 fill-current" /> {b.rating}
                  </span>
                )}
              </div>
            </div>
            <div className="p-4">
              {b.description && <p className="text-sm text-muted-foreground">{b.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {b.category && (
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-foreground">
                    {b.category}
                  </span>
                )}
                {b.area && (
                  <span className="rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-foreground">
                    📍 {b.area}
                  </span>
                )}
              </div>
              {(b.phone || b.area) && (
                <div className="mt-4 flex gap-2">
                  {b.phone && (
                    <a
                      href={`tel:${b.phone}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
                    >
                      <Phone className="h-4 w-4" /> Call
                    </a>
                  )}
                  {b.area && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(b.name + " " + b.area + " Goa")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground"
                      aria-label={`Open ${b.name} on Google Maps`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {open && (
        <ListDialog
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["businesses"] });
            toast.success("Business listed!");
          }}
        />
      )}
    </AppLayout>
  );
}

function ListDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "Cafe", area: "", phone: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("businesses").insert({ ...form, owner_id: user.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl bg-card p-5 shadow-card sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">List your business</h2>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            placeholder="Business name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <textarea
            rows={3}
            placeholder="Short description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            placeholder="Area (e.g. Panjim)"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Publish
          </button>
        </form>
      </div>
    </div>
  );
}
