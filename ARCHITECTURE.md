# Goa Social — architecture, backend, deployment, and the plan

Live: **https://goasocial.in** · Repo: **GOA-COMMUNITY/goa-connect** · Hosting: **GitHub Pages**

---

## 1. The whole system at a glance

```text
                        ┌──────────────────────────────────────────┐
                        │            VISITOR (mobile-first)        │
                        └───────────────────┬──────────────────────┘
                                            │ https://goasocial.in
                        ┌───────────────────▼──────────────────────┐
                        │  GitHub Pages — static SPA (dist/client) │
                        │  index.html + 404.html fallback + CNAME  │
                        │  /cached/*.mp4  (100 shorts, self-hosted)│
                        └──────┬───────────────────────┬───────────┘
                               │                       │
              browser JS calls │                       │ media served from same origin
                               ▼                       ▼
   ┌────────────────────────────────────────┐   ┌───────────────────────┐
   │  Supabase (Postgres + Auth + Storage)  │   │  public/cached/*.mp4  │
   │  RLS on every table                    │   │  cached-shorts.json   │
   │  Edge Function: ai-reply               │   └───────────────────────┘
   └───────────────┬────────────────────────┘
                   │ Gemini key → OpenAI-compatible → Lovable (fallback chain)
                   ▼
        ┌──────────────────────────┐
        │  AI persona reply engine │
        └──────────────────────────┘

   CONTENT ROBOT (GitHub Actions, every 30 min)
   yt-dlp + ffmpeg → 144p clips → public/cached → commit → rebuild → Pages
```

## 2. Front-end structure

```text
src/routes/                     what the visitor sees
  index.tsx        /            shorts feed + events woven in every 4th card
  events.tsx       /events      full events calendar with filters
  explore.tsx      /explore     people & businesses, one-tap chat
  business.tsx     /business    local business directory
  my-feed.tsx      /my-feed     personalised ranking
  s.$id.tsx        /s/:id       shareable single short
  auth.tsx         /auth        personal / business + Goan / tourist sign-up
  privacy • terms • refunds     legal pages (needed for payments later)
  _authenticated/               session required
    chats.*        /chats       list + room (query-param room for static hosting)
    profile.tsx    /profile     identity editor
    admin.tsx      /admin       channels, shorts engine, events, stats

src/components/  ShortsFeed · ChatRoom · EventCard · SplashScreen · AppLayout · …
src/lib/         chat · events · app-settings · viewer-context (ranking) ·
                 shorts-warmup · user-shorts · net-quality
```

Data flow rule: route loaders/queries → TanStack Query cache → components.
No page does its own ad-hoc fetching in `useEffect`.

## 3. Backend (Postgres, everything behind Row Level Security)

```text
profiles ──< follows >── profiles        identity, Goan/tourist, business fields,
   │                                     persona fields for the AI members
   ├──< conversations >──< messages      1:1 chat, membership-checked reads,
   │                                     future-dated messages stay hidden
   ├──< user_shorts                      member uploads (join the main feed)
   ├──< businesses                       directory listings
   └──< user_roles                       admin / moderator (never on profiles)

events            curated calendar, published rows public, admin writes
short_likes / short_comments / short_events   engagement + watch signals
app_settings      shorts engine knobs, read publicly, written by admins only
site_content      editable copy
```

Guarantees in place: every table has RLS plus explicit grants; roles live in
their own table checked by a security-definer `has_role`; chat reads require
conversation membership; scheduled AI replies are invisible until their time.

## 4. The AI members

- Each persona has a deterministic fingerprint: tone, length, punctuation,
  emoji habit, typo rate, message splitting, and its own reply rhythm.
- Reply timing bands: 1–7 min, 8–48 min, 1–4 h, 4–10 h, 10–25 h — with
  overnight messages pushed to the next morning, Goa time.
- Provider order: your Gemini key → any OpenAI-compatible endpoint →
  Lovable. Swapping providers is one environment variable, no code change.

## 5. Deployment

```text
push to main ──► Actions: install → build → dist/client → Pages → goasocial.in
every 30 min ──► Actions: yt-dlp/ffmpeg refresh the 100-short pool → rebuild
```

Safety: deployments are never cancelled mid-flight; `404.html` mirrors
`index.html` so deep links survive a hard refresh; `CNAME` is re-copied on
every publish so the domain can't drop.

## 6. Portability

Plain Vite + React 19 + TanStack + Tailwind v4 + Supabase in a normal Git
repo. Any agent or human can clone and continue — see `PORTABILITY.md`.

## 7. The plan, in order

1. **Now** — shorts + events as the daily habit, AI members keeping the place
   warm, businesses discoverable.
2. **Next** — automated event/news ingestion from 10–15 Goan sources so the
   calendar fills itself.
3. **Then** — self-serve business listings and event boosts (the first money).
4. **Later** — dating, only once real members, and enough women, are present.
