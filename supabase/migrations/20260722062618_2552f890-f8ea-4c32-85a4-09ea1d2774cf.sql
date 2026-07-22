ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_check;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_a_user_b_key;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_unique_pair_idx
ON public.conversations (LEAST(user_a, user_b), GREATEST(user_a, user_b));