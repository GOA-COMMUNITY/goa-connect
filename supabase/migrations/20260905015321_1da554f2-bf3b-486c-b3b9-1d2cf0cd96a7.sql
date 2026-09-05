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

DROP POLICY IF EXISTS "msg_member_read" ON public.messages;
CREATE POLICY "msg_member_read" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) AND created_at <= now());