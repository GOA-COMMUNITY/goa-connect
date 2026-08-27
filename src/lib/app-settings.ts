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
