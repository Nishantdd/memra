import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", cli: "src/cli.ts" },
    platform: "node",
    dts: false,
  },
});
