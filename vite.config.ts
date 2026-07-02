// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const base = process.env.BASE_URL ?? "/vega_studio/";

export default defineConfig({
  // Vite config must be passed via the `vite` key so the lovable wrapper
  // forwards it through to Vite (base path for GitHub Pages, etc.).
  vite: {
    base,
  },
  // Skip Nitro SSR build — this is a pure client-side SPA for GitHub Pages.
  // The client build already produces all the JS/CSS assets we need.
  nitro: false,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
