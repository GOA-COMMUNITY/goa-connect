CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'general',
  area text,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  price text,
  image_url text,
  ticket_url text,
  emoji text,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX events_starts_at_idx ON public.events (starts_at);

GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published events are public" ON public.events
  FOR SELECT TO anon, authenticated USING (is_published = true);

CREATE POLICY "Admins can view all events" ON public.events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete events" ON public.events
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.events (title, description, category, area, venue, starts_at, price, emoji, is_featured) VALUES
('Saturday Night Market', 'Arpora''s legendary night market — food, live music, shopping till late.', 'market', 'North Goa', 'Arpora', now() + interval '3 days' + interval '18 hours', '₹100 entry', '🛍️', true),
('Sunset Jam at Vagator', 'Live acoustic Goan-fusion set on the cliff as the sun drops.', 'music', 'North Goa', 'Vagator Cliff', now() + interval '5 days' + interval '17 hours', 'Free', '🎸', false),
('Panjim Heritage Walk', 'Guided walk through Fontainhas — Latin Quarter houses, bakeries and chapels.', 'culture', 'Panjim', 'Fontainhas', now() + interval '8 days' + interval '8 hours', '₹499', '🏛️', false),
('Palolem Beach Cleanup', 'Volunteer morning cleanup, breakfast provided by local cafes.', 'community', 'South Goa', 'Palolem Beach', now() + interval '10 days' + interval '7 hours', 'Free', '🌊', false);