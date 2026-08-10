import { supabase } from "@/integrations/supabase/client";

export type ShortsSettings = {
  cachedFirst: boolean;
  autoRefresh: boolean;
  maxCached: number;
  /** When false, only shorts downloaded onto Goa Social hosting are played. */
  embedsEnabled: boolean;
};

export const defaultShortsSettings: ShortsSettings = {
  cachedFirst: true,
  autoRefresh: true,
  maxCached: 100,
  embedsEnabled: true,
};

let cached: Promise<ShortsSettings> | null = null;

export function getShortsSettings(): Promise<ShortsSettings> {
  if (cached) return cached;
  cached = supabase
    .from("app_settings")
    .select("value")
    .eq("key", "shorts")
    .maybeSingle()
    .then(({ data }) => ({
      ...defaultShortsSettings,
      ...((data?.value as Partial<ShortsSettings> | null) ?? {}),
    }))
    .catch(() => defaultShortsSettings);
  return cached;
}
