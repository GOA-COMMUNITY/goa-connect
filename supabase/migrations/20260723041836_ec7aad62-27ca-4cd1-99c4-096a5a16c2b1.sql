
-- Youtube channels admin can manage; scraper reads from here
CREATE TABLE IF NOT EXISTS public.youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  icon text DEFAULT '🌴',
  priority int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.youtube_channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.youtube_channels TO authenticated;
GRANT ALL ON public.youtube_channels TO service_role;

ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yt_channels_read_all" ON public.youtube_channels FOR SELECT USING (true);
CREATE POLICY "yt_channels_admin_write" ON public.youtube_channels FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_yt_channels_updated_at
BEFORE UPDATE ON public.youtube_channels
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed with existing channels
INSERT INTO public.youtube_channels (name, url, icon, priority) VALUES
  ('Adventure Goa DK', 'https://www.youtube.com/@adventuregoadk/shorts', '🌴', 1),
  ('RDXGOA GOA NEWS', 'https://www.youtube.com/@RDXGOA/shorts', '🎥', 2)
ON CONFLICT DO NOTHING;

-- Per-short likes (Goa Social native, starts at 100)
CREATE TABLE IF NOT EXISTS public.short_likes (
  user_id uuid NOT NULL,
  video_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.short_likes TO authenticated;
GRANT SELECT ON public.short_likes TO anon;
GRANT ALL ON public.short_likes TO service_role;
ALTER TABLE public.short_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "short_likes_read_all" ON public.short_likes FOR SELECT USING (true);
CREATE POLICY "short_likes_own_write" ON public.short_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "short_likes_own_delete" ON public.short_likes FOR DELETE
  USING (auth.uid() = user_id);
