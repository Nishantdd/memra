import react from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  plugins: lazyPlugins(() => [react()]),
  css: {
    preprocessorOptions: {
      scss: { api: "modern-compiler", quietDeps: true, silenceDeprecations: ["mixed-decls", "import"] },
    },
  },
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:3000", changeOrigin: false } },
  },
});
