
CREATE TABLE public.user_shorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text NOT NULL DEFAULT '',
  video_path text NOT NULL,
  poster_path text,
  duration_seconds numeric,
  area text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_shorts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_shorts TO authenticated;
GRANT ALL ON public.user_shorts TO service_role;
ALTER TABLE public.user_shorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active uploaded shorts" ON public.user_shorts FOR SELECT USING (is_active = true OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Members can upload shorts" ON public.user_shorts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can update their shorts" ON public.user_shorts FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners can delete their shorts" ON public.user_shorts FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.short_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX short_comments_video_idx ON public.short_comments (video_id, created_at DESC);
GRANT SELECT ON public.short_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_comments TO authenticated;
GRANT ALL ON public.short_comments TO service_role;
ALTER TABLE public.short_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read short comments" ON public.short_comments FOR SELECT USING (true);
CREATE POLICY "Members can comment" ON public.short_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners can delete their comments" ON public.short_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.short_events (
  id bigserial PRIMARY KEY,
  video_id text NOT NULL,
  source text NOT NULL DEFAULT 'youtube',
  kind text NOT NULL,
  user_id uuid,
  watch_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT short_events_source_check CHECK (source IN ('youtube','upload')),
  CONSTRAINT short_events_kind_check CHECK (kind IN ('view','watch','like','unlike','share','skip','complete','comment'))
);
CREATE INDEX short_events_video_idx ON public.short_events (video_id, created_at DESC);
CREATE INDEX short_events_created_idx ON public.short_events (created_at DESC);
GRANT INSERT ON public.short_events TO anon;
GRANT INSERT, SELECT ON public.short_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.short_events_id_seq TO anon, authenticated;
GRANT ALL ON public.short_events TO service_role;
ALTER TABLE public.short_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a short event" ON public.short_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read analytics" ON public.short_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view shorts media" ON storage.objects FOR SELECT USING (bucket_id = 'shorts');
CREATE POLICY "Members can upload shorts media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shorts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Members can delete their shorts media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shorts' AND (storage.foldername(name))[1] = auth.uid()::text);
