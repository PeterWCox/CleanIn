import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { extensionVersion } from "./extension.config";

const production = process.env.CLEANIN_PRODUCTION === "1";
export default defineConfig({
  root: "src",
  publicDir: "../public",
  plugins: [react()],
  define: {
    __CLEANIN_BETA__: JSON.stringify(!production),
    __CLEANIN_VERSION__: JSON.stringify(extensionVersion),
  },
  build: {
    outDir: production
      ? resolve(process.env.CLEANIN_OUT_DIR ?? "dist")
      : resolve(homedir(), "Downloads/extensions/cleanin-dev"),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve("src/popup/popup.html"),
      output: { entryFileNames: "popup/popup.js" },
    },
  },
});
