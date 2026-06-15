import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(here, "src/index.ts"),
      name: "FeishuMcpSDK",
      formats: ["es", "umd"],
      fileName: (format) =>
        format === "es" ? "feishu-mcp-sdk.mjs" : "feishu-mcp-sdk.umd.cjs",
    },
  },
  plugins: [
    dts({
      include: ["src"],
      rootDir: resolve(here, "src"),
      outDir: resolve(here, "dist"),
    }),
  ],
});
