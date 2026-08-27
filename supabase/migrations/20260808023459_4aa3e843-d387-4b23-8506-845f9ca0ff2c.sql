ALTER TABLE public.youtube_channels
  ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS subscribers text,
  ADD COLUMN IF NOT EXISTS description text;