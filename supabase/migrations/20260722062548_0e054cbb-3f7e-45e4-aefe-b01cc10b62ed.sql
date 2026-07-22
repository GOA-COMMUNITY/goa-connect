ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_a_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_b_fkey;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user_a_profile_fkey
  FOREIGN KEY (user_a) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user_b_profile_fkey
  FOREIGN KEY (user_b) REFERENCES public.profiles(id) ON DELETE CASCADE;