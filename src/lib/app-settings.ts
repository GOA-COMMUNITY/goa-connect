import { supabase } from "@/integrations/supabase/client";

export type ShortsSettings = {
  cachedFirst: boolean;
  autoRefresh: boolean;
  maxCached: number;
  /** Download pass runs once every N days (1 = daily, 2 = every second day). */
  refreshDays: number;
  /** Only a channel's N latest shorts are ever considered. 0 = automatic. */
  perChannel: number;
  /** Clips older than this many days (from their download day) are deleted. */
  retentionDays: number;
  /** When false, only shorts downloaded onto Goa Social hosting are played. */
  embedsEnabled: boolean;
};

export const defaultShortsSettings: ShortsSettings = {
  cachedFirst: true,
  autoRefresh: true,
  maxCached: 50,
  refreshDays: 2,
  perChannel: 5,
  retentionDays: 30,
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
        const saved = (data?.value as Partial<ShortsSettings> | null) ?? {};
        // A row saved before the new engine has no retentionDays — keep its
        // toggles but use the new numeric defaults.
        const merged = saved.retentionDays !== undefined || saved.refreshDays !== undefined
          ? saved
          : {
              cachedFirst: saved.cachedFirst,
              autoRefresh: saved.autoRefresh,
              embedsEnabled: saved.embedsEnabled,
            };
        return {
          ...defaultShortsSettings,
          ...Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined)),
        } as ShortsSettings;
      } catch {
        return defaultShortsSettings;
      }
    })();
  }
  return cached;
}
