import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

const base = process.env.BASE_URL ?? "/vega_studio/";

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      // Auto-generate routeTree.gen.ts from file-based routes
      target: "react",
    }),
    react(),
    tailwindcss(),
  ],
  base,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // Use Vite's built-in tsconfig paths resolution
    tsconfigPaths: true,
  },
  build: {
    // Output to dist/ for standard SPA deployment
    outDir: "dist",
  },
});
