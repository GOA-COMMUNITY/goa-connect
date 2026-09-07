CREATE TABLE IF NOT EXISTS public.event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  kind text not null default 'rss',
  area text,
  category text not null default 'general',
  auto_publish boolean not null default false,
  is_enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text,
  last_count integer not null default 0,
  created_at timestamptz not null default now()
);

GRANT SELECT ON public.event_sources TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sources TO authenticated;
GRANT ALL ON public.event_sources TO service_role;

ALTER TABLE public.event_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sources admin manage" ON public.event_sources;
CREATE POLICY "event_sources admin manage" ON public.event_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.event_sources(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_source_url_key ON public.events (source_url) WHERE source_url IS NOT NULL;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS boost_until timestamptz;