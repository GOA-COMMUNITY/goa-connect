/*
  GOA SOCIAL — COMPLETE DATABASE SCHEMA
  Run this entire file in your Supabase SQL Editor (Dashboard → SQL Editor).
  It recreates all tables, policies, functions, triggers, and seed data
  in the correct dependency order. Safe to run on a fresh empty project.
*/

-- ========================================================================
-- 1. PROFILES
-- ========================================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text NOT NULL DEFAULT 'Goan',
  area text,
  bio text,
  avatar_emoji text DEFAULT '🌴',
  is_goan boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Drop the FK so fake profiles with synthetic UUIDs can be inserted by admins
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ========================================================================
-- 2. FOLLOWS
-- ========================================================================
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows_read_all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_self" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ========================================================================
-- 3. BUSINESSES
-- ========================================================================
CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  area text,
  phone text,
  rating numeric(2,1) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.businesses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses_read_all" ON public.businesses FOR SELECT USING (true);
CREATE POLICY "businesses_insert_owner" ON public.businesses FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "businesses_update_owner" ON public.businesses FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "businesses_delete_owner" ON public.businesses FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- ========================================================================
-- 4. CONVERSATIONS + MESSAGES
-- ========================================================================
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_pair_idx
  ON public.conversations (LEAST(user_a, user_b), GREATEST(user_a, user_b));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_member_read" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "conv_member_insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "conv_member_update" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS read_a_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS read_b_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv AND (c.user_a = _user OR c.user_b = _user)
  );
$$;

CREATE POLICY "msg_member_read" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) AND created_at <= now());
CREATE POLICY "msg_member_insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conversation_member(conversation_id, auth.uid()));

CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);
CREATE INDEX idx_conv_members ON public.conversations(user_a, user_b);

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- ========================================================================
-- 5. TRIGGERS + AUTH HELPERS
-- ========================================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_emoji, account_type, business_name, business_category, is_goan, is_tourist, origin_city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Goan'),
    '🌴',
    CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'business' THEN 'business' ELSE 'personal' END,
    NULLIF(NEW.raw_user_meta_data->>'business_name',''),
    NULLIF(NEW.raw_user_meta_data->>'business_category',''),
    COALESCE(NEW.raw_user_meta_data->>'is_tourist','') <> 'true',
    COALESCE(NEW.raw_user_meta_data->>'is_tourist','') = 'true',
    NULLIF(NEW.raw_user_meta_data->>'origin_city','')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================================================
-- 6. USER ROLES + ADMIN
-- ========================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE POLICY "user_roles_read_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(NEW.email) IN ('8010920477@goa.social','8010920477@goasocial.in','eshaanaralawrence@gmail.com') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_role() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ========================================================================
-- 7. PROFILE EXTENSIONS
-- ========================================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_tourist boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS origin_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_fake boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS personality text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language_style text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS backstory text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reply_delay_pattern text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dating_interested boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_category text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('personal','business'));

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================================================
-- 8. SITE CONTENT + APP SETTINGS
-- ========================================================================
CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_content_read_all" ON public.site_content FOR SELECT USING (true);
CREATE POLICY "site_content_admin_write" ON public.site_content FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.site_content(key, value) VALUES
  ('featured_videos', '["dQw4w9WgXcQ","9bZkp7q19f0","kJQP7kiw5Fk"]'::jsonb),
  ('hero_text', '{"title":"Susegad, welcome home 🌴","subtitle":"Goa''''s own social network — by Goans, for Goans."}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings(key, value) VALUES
  ('shorts', '{"cachedFirst": true, "autoRefresh": true, "maxCached": 10}'::jsonb),
  ('ai_replies', '{"enabled": true, "minDelayMs": 1200, "maxDelayMs": 4000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ========================================================================
-- 9. YOUTUBE CHANNELS (legacy table)
-- ========================================================================
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

ALTER TABLE public.youtube_channels
  ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS subscribers text,
  ADD COLUMN IF NOT EXISTS description text;

INSERT INTO public.youtube_channels (name, url, icon, priority) VALUES
  ('Adventure Goa DK', 'https://www.youtube.com/@adventuregoadk/shorts', '🌴', 1),
  ('RDXGOA GOA NEWS', 'https://www.youtube.com/@RDXGOA/shorts', '🎥', 2)
ON CONFLICT DO NOTHING;

-- ========================================================================
-- 10. SHORT LIKES
-- ========================================================================
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

-- ========================================================================
-- 11. USER SHORTS (uploaded videos)
-- ========================================================================
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

-- ========================================================================
-- 12. SHORT COMMENTS
-- ========================================================================
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

-- ========================================================================
-- 13. SHORT EVENTS (analytics)
-- ========================================================================
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

-- ========================================================================
-- 14. STORAGE POLICIES (shorts bucket)
-- ========================================================================
CREATE POLICY "Public can view shorts media" ON storage.objects FOR SELECT USING (bucket_id = 'shorts');
CREATE POLICY "Members can upload shorts media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'shorts' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Members can delete their shorts media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'shorts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ========================================================================
-- 15. MESSAGE RATE LIMITING
-- ========================================================================
CREATE OR REPLACE FUNCTION public.enforce_message_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_id uuid;
  mutual boolean;
  total_sent int;
  recent_sent int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = NEW.sender_id AND p.is_fake) THEN
    RETURN NEW;
  END IF;

  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO other_id
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF other_id IS NULL THEN
    RETURN NEW;
  END IF;

  mutual := EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = NEW.sender_id AND f.following_id = other_id)
        AND EXISTS (SELECT 1 FROM public.follows f WHERE f.follower_id = other_id AND f.following_id = NEW.sender_id);

  IF mutual THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = NEW.conversation_id AND m.sender_id = other_id) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO total_sent
  FROM public.messages m
  WHERE m.conversation_id = NEW.conversation_id AND m.sender_id = NEW.sender_id;

  IF total_sent < 3 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_sent
  FROM public.messages m
  WHERE m.conversation_id = NEW.conversation_id
    AND m.sender_id = NEW.sender_id
    AND m.created_at > now() - interval '24 hours';

  IF recent_sent >= 1 THEN
    RAISE EXCEPTION 'MESSAGE_LIMIT_REACHED';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_message_limits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_message_limits_trigger ON public.messages;
CREATE TRIGGER enforce_message_limits_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_limits();

-- ========================================================================
-- 16. EVENTS
-- ========================================================================
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

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.event_sources(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_source_url_key ON public.events (source_url) WHERE source_url IS NOT NULL;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS boost_until timestamptz;

INSERT INTO public.events (title, description, category, area, venue, starts_at, price, emoji, is_featured) VALUES
('Saturday Night Market', 'Arpora''s legendary night market — food, live music, shopping till late.', 'market', 'North Goa', 'Arpora', now() + interval '3 days' + interval '18 hours', '₹100 entry', '🛍️', true),
('Sunset Jam at Vagator', 'Live acoustic Goan-fusion set on the cliff as the sun drops.', 'music', 'North Goa', 'Vagator Cliff', now() + interval '5 days' + interval '17 hours', 'Free', '🎸', false),
('Panjim Heritage Walk', 'Guided walk through Fontainhas — Latin Quarter houses, bakeries and chapels.', 'culture', 'Panjim', 'Fontainhas', now() + interval '8 days' + interval '8 hours', '₹499', '🏛️', false),
('Palolem Beach Cleanup', 'Volunteer morning cleanup, breakfast provided by local cafes.', 'community', 'South Goa', 'Palolem Beach', now() + interval '10 days' + interval '7 hours', 'Free', '🌊', false)
ON CONFLICT DO NOTHING;

-- ========================================================================
-- 17. EVENT SOURCES
-- ========================================================================
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

CREATE POLICY "event_sources admin manage" ON public.event_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========================================================================
-- 18. YT CHANNELS (new admin-managed system)
-- ========================================================================
CREATE TABLE IF NOT EXISTS yt_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_url text NOT NULL,
  channel_name text NOT NULL,
  channel_handle text,
  avatar_url text,
  subscriber_count text,
  weight integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  max_shorts integer NOT NULL DEFAULT 10,
  last_fetched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE yt_channels ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON yt_channels TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON yt_channels TO authenticated;

CREATE POLICY "public_read_channels" ON yt_channels FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "admin_write_channels" ON yt_channels FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE TABLE IF NOT EXISTS yt_shorts_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES yt_channels(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  title text,
  thumbnail text,
  published_at timestamptz,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, video_id)
);

ALTER TABLE yt_shorts_pool ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON yt_shorts_pool TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON yt_shorts_pool TO authenticated;

CREATE POLICY "public_read_pool" ON yt_shorts_pool FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "admin_write_pool" ON yt_shorts_pool FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_yt_shorts_pool_fetched ON yt_shorts_pool (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_yt_channels_active ON yt_channels (is_active, weight DESC);

-- ========================================================================
-- 19. ANALYTICS FUNCTIONS
-- ========================================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION shorts_analytics_summary()
RETURNS TABLE (
  total_views bigint,
  total_likes bigint,
  total_shares bigint,
  total_watch_ms bigint,
  total_comments bigint,
  by_video jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE kind = 'view')::bigint AS total_views,
    COUNT(*) FILTER (WHERE kind = 'like')::bigint AS total_likes,
    COUNT(*) FILTER (WHERE kind = 'share')::bigint AS total_shares,
    COALESCE(SUM(watch_ms) FILTER (WHERE kind = 'watch'), 0)::bigint AS total_watch_ms,
    (SELECT COUNT(*)::bigint FROM short_comments) AS total_comments,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'video_id', video_id,
          'views', COUNT(*) FILTER (WHERE kind = 'view'),
          'likes', COUNT(*) FILTER (WHERE kind = 'like'),
          'shares', COUNT(*) FILTER (WHERE kind = 'share'),
          'watch_ms', COALESCE(SUM(watch_ms) FILTER (WHERE kind = 'watch'), 0),
          'completes', COUNT(*) FILTER (WHERE kind = 'complete'),
          'skips', COUNT(*) FILTER (WHERE kind = 'skip')
        )
      ),
      '[]'::jsonb
    ) AS by_video
  FROM short_events;
$$;

GRANT EXECUTE ON FUNCTION shorts_analytics_summary() TO authenticated;

-- ========================================================================
-- DONE. All tables, policies, functions, triggers, and seed data created.
-- ========================================================================
