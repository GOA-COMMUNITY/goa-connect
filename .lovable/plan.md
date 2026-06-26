# Goa Social — make it functional

Static SPA on GitHub Pages, so **all backend calls go straight from the browser to Lovable Cloud** (no `createServerFn`; those don't ship to Pages). Auth gating is client-side.

## 1. Database (one migration)

Tables in `public`, each with `GRANT` + RLS + policies:

- **profiles** — `id (uuid PK = auth.users.id)`, `username`, `display_name`, `area`, `bio`, `avatar_emoji`, `is_goan bool`, `created_at`. Auto-created on signup via `handle_new_user()` trigger on `auth.users`.
- **follows** — `(follower_id, following_id)` composite PK.
- **businesses** — `id`, `owner_id`, `name`, `description`, `category`, `area`, `phone`, `rating`, `created_at`. Public read, owner write.
- **conversations** — `id`, `user_a`, `user_b` (sorted), `last_message_at`. Unique on the pair.
- **messages** — `id`, `conversation_id`, `sender_id`, `body`, `created_at`. Realtime publication enabled. Policies via a `is_conversation_member()` security-definer fn (no recursive RLS).

## 2. Auth

- New route `/auth` — email/password sign-in + sign-up + **Google** (via `lovable.auth.signInWithOAuth`). Configured the same turn with `supabase--configure_social_auth`.
- Integration-managed `_authenticated/route.tsx` gate (auto-shipped, `ssr:false`).
- Move `/chats`, `/chats/$id`, `/profile` under `_authenticated/`. Keep `/`, `/explore`, `/business` public; show "Sign in to message / follow / list" CTAs when signed out.
- Root: `onAuthStateChange` invalidates queries on `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED`.

## 3. Routes (rewritten to use Supabase + TanStack Query)

- **`/` (home)** — keep current `videos.json` feed; add "like" only if signed in.
- **`/explore`** — list real profiles from `profiles` (filter by area chip), Follow/Message buttons gated on auth.
- **`/business`** — list real businesses; "+ List" opens a dialog (auth required) that inserts into `businesses`.
- **`/_authenticated/chats`** — conversations the user is in, sorted by `last_message_at`; "Compose" picks a profile to start a thread.
- **`/_authenticated/chats/$id`** — realtime message thread (subscribe to `messages` filtered by `conversation_id`, cleanup on unmount).
- **`/_authenticated/profile`** — real profile, edit form (display name / area / bio / emoji), sign out with proper cache teardown.

## 4. Cleanup

Files to delete (confirmed unused after rewrite):
- `src/routes/README.md` — boilerplate notes.
- Unused shadcn primitives in `src/components/ui/` not referenced anywhere after the rewrite (carousel, chart, sidebar, menubar, navigation-menu, resizable, pagination, breadcrumb, command, context-menu, hover-card, input-otp, calendar, table, accordion, collapsible, drawer, alert-dialog, aspect-ratio) — I'll `rg` each to confirm zero refs before deleting.

Keeping: `public/videos.json`, `public/events.json`, `server.ts`, `start.ts`, `vite.config.ts` (needed by the build even on Pages).

## 5. Verify

- `bun run build:dev` to confirm the static SPA still builds.
- Quick Playwright smoke run on `localhost:8080`: load `/`, `/explore`, `/business`, hit `/auth`, confirm the gate bounces `/chats`.

## Out of scope (call out explicitly)

- Stories, video uploads, push notifications, payments / "free messages" paywall, business booking flow, search index — all visible in the UI but mocked. I'll leave the existing chip UI and copy in place so nothing looks broken.
- Server functions / webhooks — incompatible with GitHub Pages static hosting; everything is browser → Cloud.

Confirm and I'll execute end-to-end in one pass.
