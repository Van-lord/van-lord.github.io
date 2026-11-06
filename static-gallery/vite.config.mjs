import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: false,
  base: "/",
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../_site", import.meta.url)),
    emptyOutDir: false,
    sourcemap: false,
    target: "es2022",
  },
});
