import { supabase } from "@/integrations/supabase/client";

export type ShortsSettings = {
  cachedFirst: boolean;
  autoRefresh: boolean;
  maxCached: number;
  /** Rebuild the pool every N days (1 = daily, 2 = every second day). */
  refreshDays: number;
  /** Max shorts pulled per channel per cycle. 0 = automatic from weights. */
  perChannel: number;
  /** When false, only shorts downloaded onto Goa Social hosting are played. */
  embedsEnabled: boolean;
};

export const defaultShortsSettings: ShortsSettings = {
  cachedFirst: true,
  autoRefresh: true,
  maxCached: 100,
  refreshDays: 1,
  perChannel: 0,
  // Off by default: only shorts downloaded onto Goa Social hosting play.
  embedsEnabled: false,
};



let cached: Promise<ShortsSettings> | null = null;

export function getShortsSettings(): Promise<ShortsSettings> {
  if (!cached) {
    cached = (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "shorts")
          .maybeSingle();
        return {
          ...defaultShortsSettings,
          ...((data?.value as Partial<ShortsSettings> | null) ?? {}),
        };
      } catch {
        return defaultShortsSettings;
      }
    })();
  }
  return cached;
}
