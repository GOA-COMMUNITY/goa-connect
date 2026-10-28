/*
# Goa Social — Shorts Download System

1. New Tables
- `yt_downloaded_shorts` — stores metadata for YouTube shorts that have been
  downloaded and uploaded to Supabase Storage. Each row maps a video_id to its
  storage path, the channel it came from, file size, duration, and download date.
- Columns: id, channel_id (FK yt_channels), video_id, title, storage_path,
  poster_path, file_size_bytes, duration_seconds, downloaded_at, is_active

2. Settings
- Adds a `shorts_download` key to `app_settings` with defaults:
  enabled=true, refreshIntervalDays=3, maxPerChannel=10, deleteOldAfterDays=30,
  downloadQuality="best"

3. Storage
- Uses the existing `shorts` storage bucket for downloaded video files.
- Files stored under `downloads/{video_id}.mp4`.

4. Security
- yt_downloaded_shorts: RLS enabled. Public SELECT (anon + authenticated) so
  the feed can read. Admin-only writes via existing admin policies on app_settings.
- service_role has full access for edge functions.
*/

CREATE TABLE IF NOT EXISTS public.yt_downloaded_shorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.yt_channels(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  title text,
  storage_path text NOT NULL,
  poster_path text,
  file_size_bytes bigint DEFAULT 0,
  duration_seconds numeric,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(video_id)
);

CREATE INDEX IF NOT EXISTS idx_yt_downloaded_shorts_active
  ON public.yt_downloaded_shorts (is_active, downloaded_at DESC);

ALTER TABLE public.yt_downloaded_shorts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.yt_downloaded_shorts TO anon, authenticated;
GRANT ALL ON public.yt_downloaded_shorts TO service_role;

DROP POLICY IF EXISTS "public_read_downloaded_shorts" ON public.yt_downloaded_shorts;
CREATE POLICY "public_read_downloaded_shorts" ON public.yt_downloaded_shorts
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_downloaded_shorts" ON public.yt_downloaded_shorts;
CREATE POLICY "admin_write_downloaded_shorts" ON public.yt_downloaded_shorts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage policies for downloaded shorts (bucket already exists with policies,
-- but downloaded files live under downloads/ prefix so we add explicit policies)
DROP POLICY IF EXISTS "Public can view downloaded shorts" ON storage.objects;
CREATE POLICY "Public can view downloaded shorts" ON storage.objects
  FOR SELECT USING (bucket_id = 'shorts');

DROP POLICY IF EXISTS "Service role can manage downloaded shorts" ON storage.objects;
CREATE POLICY "Service role can manage downloaded shorts" ON storage.objects
  FOR ALL USING (bucket_id = 'shorts' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'shorts' AND auth.role() = 'service_role');

-- Download settings
INSERT INTO public.app_settings(key, value) VALUES
  ('shorts_download', '{"enabled": true, "refreshIntervalDays": 3, "maxPerChannel": 10, "deleteOldAfterDays": 30, "downloadQuality": "best"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
