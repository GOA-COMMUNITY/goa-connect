# Goa Social

Community app for Goa — shorts feed, people discovery, chat, business listings.
Live at **https://goasocial.in** (GitHub Pages), repo **GOA-COMMUNITY/goa-connect**.

This project is **not locked to any single AI tool**. It is a plain
Vite + React + TypeScript app in a normal Git repo. Any agent (Bolt, Cursor,
Manus, Claude Code, a human dev) can clone it and work on it.

## Stack

- React 19 + TypeScript
- TanStack Router (file-based routing, `src/routes/`) + TanStack Query
- Tailwind CSS v4 (`src/styles.css`)
- Vite 7, built as a **static SPA** (`vite.config.ts`, `nitro: false`)
- Backend: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)
- Deploy: GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml`)

## Local development

```bash
bun install     # or: npm install
bun run dev     # http://localhost:8080
bun run build   # static output in dist/client
```

## Environment variables (`.env`)

```
VITE_SUPABASE_URL=https://kmwwbjedvsxqobfcgsfx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>
VITE_SUPABASE_PROJECT_ID=kmwwbjedvsxqobfcgsfx
```

The publishable key is safe in the client; every table is protected by
Row Level Security. Service-role keys are never used in the browser.

## Project map

```
src/routes/                 pages (file-based routing)
  index.tsx                 home + shorts feed
  explore.tsx               discover people, follow, start chat
  business.tsx              local businesses
  my-feed.tsx               personalised feed view
  s.$id.tsx                 public share page for one short
  auth.tsx                  sign in / sign up / guest account
  _authenticated/           routes that require a session
    chats.tsx               layout (renders <Outlet />)
    chats.index.tsx         chat list  (/chats)
    chats.$id.tsx           chat room  (/chats/:id)
    profile.tsx             profile editor
    admin.tsx               admin dashboard
src/components/             ShortsFeed, ShortUpload, AppLayout, SplashScreen…
src/lib/                    chat, shorts caching, viewer context, settings
scripts/                    cache-shorts.mjs, update-videos.mjs (CI content jobs)
supabase/functions/ai-reply Gemini-powered replies for community bots
```

## How content works

`scripts/update-videos.mjs` refreshes the latest shorts list from the channels
configured in the admin dashboard; `scripts/cache-shorts.mjs` downloads and
compresses up to 100 clips per day into `public/cached/` so playback is instant.
Both run in the deploy workflow (every 30 minutes) — see
`docs/shorts-download-pipeline.md`.

## Deployment

Push to `main` → GitHub Action builds and publishes `dist/client` to GitHub
Pages. The workflow copies `public/CNAME` and duplicates `index.html` to
`404.html` so client-side deep links (e.g. `/chats/<id>`) work on hard refresh.

Repo visibility, custom domain (`goasocial.in`) and Pages settings are managed
in the GitHub repository settings.

## Handing this project to another AI agent

Give them: the repo URL, the `.env` values above, and this README. Everything
else (routes, styles, database schema types in
`src/integrations/supabase/types.ts`) is in the repo.
