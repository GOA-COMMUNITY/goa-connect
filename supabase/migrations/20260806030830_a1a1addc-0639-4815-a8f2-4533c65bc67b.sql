-- Master admin grant on signup (works without any server code)
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

-- Backfill for accounts that already exist
INSERT INTO public.user_roles(user_id, role)
SELECT id, 'admin'::app_role FROM auth.users
WHERE lower(email) IN ('8010920477@goa.social','8010920477@goasocial.in','eshaanaralawrence@gmail.com')
ON CONFLICT DO NOTHING;

-- Simple key/value settings the admin console can toggle
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings readable" ON public.app_settings;
CREATE POLICY "settings readable" ON public.app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage settings" ON public.app_settings;
CREATE POLICY "admins manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings(key, value) VALUES
  ('shorts', '{"cachedFirst": true, "autoRefresh": true, "maxCached": 10}'::jsonb),
  ('ai_replies', '{"enabled": true, "minDelayMs": 1200, "maxDelayMs": 4000}'::jsonb)
ON CONFLICT (key) DO NOTHING;