ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_category text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_type_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_account_type_check CHECK (account_type IN ('personal','business'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_emoji, account_type, business_name, business_category)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Goan'),
    '🌴',
    CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'business' THEN 'business' ELSE 'personal' END,
    NULLIF(NEW.raw_user_meta_data->>'business_name',''),
    NULLIF(NEW.raw_user_meta_data->>'business_category','')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $function$;