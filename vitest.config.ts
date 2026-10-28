import { defineConfig } from "vitest/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { resolve } from "node:path";
import { extensionVersion } from "./extension.config";
export default defineConfig({
  test: {
    projects: [
      {
        define: {
          __CLEANIN_VERSION__: JSON.stringify(extensionVersion),
          __CLEANIN_BETA__: true,
        },
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["tests/**/*.test.{ts,tsx}"],
        },
      },
      {
        plugins: [storybookTest({ configDir: resolve(".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
