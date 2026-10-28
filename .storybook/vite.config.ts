import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { extensionVersion } from "../extension.config";
export default defineConfig({
  plugins: [react()],
  define: {
    __CLEANIN_BETA__: true,
    __CLEANIN_VERSION__: JSON.stringify(extensionVersion),
  },
});
