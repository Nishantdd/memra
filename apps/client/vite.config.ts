import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig(({ mode }) => ({
  plugins: lazyPlugins(() => [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons/*.png"],
      manifest: {
        name: "Memra",
        short_name: "Memra",
        description: "Your notes, searchable by meaning.",
        // Manifests cannot reference CSS variables; these are Carbon gray-100 and gray-10 backgrounds.
        theme_color: "#161616",
        background_color: "#f4f4f4",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["**/*Cyrillic*", "**/*Greek*", "**/*Pi-*", "**/*Latin2*", "**/*Latin3*"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      devOptions: { enabled: mode === "pwa-dev", type: "module" },
    }),
  ]),
  css: {
    preprocessorOptions: {
      scss: { quietDeps: true, silenceDeprecations: ["mixed-decls", "import"] },
    },
  },
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: false } },
  },
}));
