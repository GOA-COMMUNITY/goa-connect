// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths, nitro, componentTagger (dev-only), VITE_* env injection, @ alias, dedupe,
// error logger plugins, and sandbox detection. Do NOT re-add them.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    // Static SPA output for GitHub Pages — produces an index.html shell that hydrates client-side.
    spa: {
      enabled: true,
    },
    // Prerender every route file to a static HTML file so deep links (/explore, /business, ...)
    // resolve on GitHub Pages without a server.
    pages: [
      { path: "/" },
      { path: "/explore" },
      { path: "/business" },
      { path: "/chats" },
      { path: "/profile" },
    ],
  },
});
