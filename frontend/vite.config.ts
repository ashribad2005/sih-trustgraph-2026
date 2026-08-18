import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * vite.config.ts
 * ===============
 * TrustGraph 2026 — Vite + React Configuration
 *
 * - Proxies /api/* to the FastAPI backend (Module 3) at localhost:8000
 * - Proxies /data/* to serve mock JSON fixtures from ../data/
 * - Path aliases: @components, @data
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@components": path.resolve(__dirname, "src/components"),
      "@data":       path.resolve(__dirname, "../data"),
    },
  },

  // Serve mock data files from repo /data directory during development
  publicDir: "../data",

  server: {
    port: 5173,
    proxy: {
      // Forward API calls to FastAPI backend
      "/api": {
        target:       "http://localhost:8000",
        changeOrigin: true,
        rewrite:      (p) => p.replace(/^\/api/, ""),
      },
    },
  },

  build: {
    outDir:        "../dist",
    emptyOutDir:   true,
    sourcemap:     true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Cytoscape into its own chunk (large dependency)
          cytoscape: ["cytoscape", "react-cytoscapejs", "cytoscape-dagre"],
          react:     ["react", "react-dom"],
        },
      },
    },
  },
});
