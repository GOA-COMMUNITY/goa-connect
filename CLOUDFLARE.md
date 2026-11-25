# Cloudflare Pages deployment — GOA-COMMUNITY/goa-connect

This app is a static SPA (Vite, output in `dist/client`) with Supabase doing
all dynamic work, so it deploys to Cloudflare Pages with no code changes.

## One-time setup in the Cloudflare dashboard

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorize Cloudflare to access GitHub and select `GOA-COMMUNITY/goa-connect`.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build` (or `bun run build`)
   - Build output directory: `dist/client`
4. Environment variables (Production *and* Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
   (Values are in the repo `.env`; they are public client keys, safe to paste.)
5. Save and deploy.

From then on, **every push to `main` deploys automatically** — including
commits made from Bolt. No manual step is needed per deploy.

## What this repo already contains for Cloudflare

- `public/_redirects` — SPA fallback so deep links like `/chats/<id>` work on
  hard refresh (Cloudflare needs this explicitly; GitHub Pages used a copied
  404.html instead).
- `public/_headers` — never cache `index.html`, immutable cache for hashed
  assets, daily cache for the shorts clips.

## Custom domain (goasocial.in)

In the Pages project → **Custom domains** → add `goasocial.in`, then at your
DNS provider point the domain at Cloudflare (a CNAME to
`<project>.pages.dev`, or nameservers if the domain is managed in
Cloudflare). `public/CNAME` is only used by GitHub Pages and is harmless here.

## Notes

- The GitHub Actions deploy (`.github/workflows/deploy.yml`) keeps running
  until you disable it — the two hosts are independent. Point DNS wherever
  you want traffic to go; leaving both live is fine during migration.
- The shorts download workflows (`download-shorts.yml`, every 30 min) commit
  refreshed clips to `public/cached`; each such push triggers a Cloudflare
  deploy of the new pool. If that gets too chatty, switch those workflows to
  `workflow_dispatch` only.
