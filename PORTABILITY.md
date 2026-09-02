# Portability — Goa Social is not locked to any one AI tool

This repo is plain **Vite + React 19 + TanStack Start + Tailwind v4 + Supabase**.
Nothing here needs Lovable to build, run, or deploy. Any agent (Bolt, Cursor,
Manus, Windsurf, Claude Code) or a human can take over by cloning the repo.

## Run locally

```bash
bun install      # or: npm install
bun run dev      # http://localhost:8080
bun run build    # static output in dist/client
```

## Hosting

GitHub Pages via `.github/workflows/deploy.yml` (branch `main`, custom domain
`goasocial.in` from `public/CNAME`). No Lovable hosting involved.

## Backend

Supabase (Postgres + Auth + Storage + Edge Functions). Migrations live in
`supabase/migrations`. To move to your own Supabase project:

1. Create a project, run `supabase db push`.
2. Update `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy functions: `supabase functions deploy ai-reply`.

## AI (the persona chat)

`supabase/functions/ai-reply/index.ts` picks a provider in this order:

1. `GEMINI_API_KEY` — Google AI Studio key (current primary, free tier).
2. `OPENAI_API_KEY` (+ optional `OPENAI_BASE_URL`, `OPENAI_MODEL`) — works with
   OpenAI, OpenRouter, Groq, Together, Ollama, or any OpenAI-compatible endpoint.
3. `LOVABLE_API_KEY` — only used if neither of the above is set.

So when Lovable credits run out, set `GEMINI_API_KEY` (or an OpenRouter free
model via `OPENAI_BASE_URL=https://openrouter.ai/api/v1`) and everything keeps
working with zero code changes.

## Media pipeline

`scripts/cache-shorts.mjs` + the GitHub Action download and cache the shorts
pool. It uses `yt-dlp` + `ffmpeg` only — no proprietary service.
