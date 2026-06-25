// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro, componentTagger (dev-only), VITE_* env injection, @ alias, dedupe,
// error logger plugins, and sandbox detection. Do NOT re-add them.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // Static SPA output for GitHub Pages — single index.html shell that
    // hydrates client-side. The deploy workflow copies index.html → 404.html
    // so deep links (/explore, /business, ...) resolve via the SPA fallback.
    spa: {
      enabled: true,
      prerender: { enabled: false, outputPath: "index.html", crawlLinks: false, retryCount: 0 },
    },
  },
});
