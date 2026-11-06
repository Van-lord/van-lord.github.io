import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build the public homepage; build-pages.mjs adds the static photographic archive.
// Management tools remain separate from the public GitHub Pages output.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  base: "/",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../_site", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
});
