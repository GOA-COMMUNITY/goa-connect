
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS read_a_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS read_b_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dating_interested boolean NOT NULL DEFAULT false;

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
  -- Demo/AI personas are never rate limited.
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

  -- If the other person has already replied, the conversation is open.
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

DROP TRIGGER IF EXISTS enforce_message_limits_trigger ON public.messages;
CREATE TRIGGER enforce_message_limits_trigger
BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_limits();
