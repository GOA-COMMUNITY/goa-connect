## Deployment

Push to `main` → GitHub Action builds and publishes `dist/client` to GitHub
Pages. The workflow copies `public/CNAME` and duplicates `index.html` to
`404.html` so client-side deep links (e.g. `/chats/<id>`) work on hard refresh.

**Cloudflare Pages (new):** the repo is also ready to deploy to Cloudflare
Pages — see `CLOUDFLARE.md` for the one-time setup. After connecting the repo
there, every push to `main` deploys to Cloudflare automatically. The two
hosts (GitHub Pages and Cloudflare) are independent; point the `goasocial.in`
DNS at whichever should serve traffic.
