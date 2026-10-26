/*
# YouTube channel management tables for Goa Social admin

This migration creates the database tables that power the admin panel's
YouTube channel management system. The admin can add YouTube channel URLs,
control their weight in the feed algorithm, set how many shorts to pull
per channel, and trigger a refresh that fetches the latest shorts from
each channel.

## New Tables

### yt_channels
Stores YouTube channel links that the admin has added. Each row represents
one YouTube channel whose shorts should appear in the Goa Social feed.

- `id` — UUID primary key
- `channel_url` — the channel's YouTube URL (e.g. https://youtube.com/@adventuregoa)
- `channel_name` — display name shown in admin UI
- `channel_handle` — @handle extracted from the URL (nullable)
- `avatar_url` — channel avatar image (nullable)
- `subscriber_count` — subscriber count text (nullable)
- `weight` — integer weight for feed ranking (default 1, higher = more prominent)
- `is_active` — whether this channel's shorts are included in refreshes (default true)
- `max_shorts` — max shorts to pull per refresh cycle (default 10)
- `last_fetched_at` — timestamp of the last successful refresh (nullable)
- `created_at` — row creation timestamp

### yt_shorts_pool
Stores individual shorts discovered from each channel.

- `id` — UUID primary key
- `channel_id` — foreign key to yt_channels.id
- `video_id` — YouTube video ID (11 characters)
- `title` — video title (nullable)
- `thumbnail` — thumbnail URL (nullable)
- `published_at` — when the short was published on YouTube (nullable)
- `fetched_at` — when this row was inserted/updated

UNIQUE constraint on (channel_id, video_id) prevents duplicates.

## Security
- RLS enabled on both tables.
- Public can read the pool (the home feed needs it) but cannot write.
- Only authenticated admins can insert/update/delete channels and pool rows.
- Admin detection is via the existing user_roles table (role = 'admin').

## Functions
- `shorts_analytics_summary()` — SECURITY DEFINER function that aggregates
  short_events data for the admin dashboard. Returns total views, likes,
  shares, watch time, comments, and a per-video breakdown.
- `is_admin()` — helper that checks if the current user has admin role.
*/

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

DROP POLICY IF EXISTS "public_read_channels" ON yt_channels;
CREATE POLICY "public_read_channels"
  ON yt_channels FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_write_channels" ON yt_channels;
CREATE POLICY "admin_write_channels"
  ON yt_channels FOR ALL
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

DROP POLICY IF EXISTS "public_read_pool" ON yt_shorts_pool;
CREATE POLICY "public_read_pool"
  ON yt_shorts_pool FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_write_pool" ON yt_shorts_pool;
CREATE POLICY "admin_write_pool"
  ON yt_shorts_pool FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));


CREATE INDEX IF NOT EXISTS idx_yt_shorts_pool_fetched ON yt_shorts_pool (fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_yt_channels_active ON yt_channels (is_active, weight DESC);


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
