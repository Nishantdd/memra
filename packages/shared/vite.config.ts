import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", "markdown/index": "src/markdown/index.ts" },
    dts: true,
    unbundle: true,
    deps: { onlyBundle: false },
  },
});
