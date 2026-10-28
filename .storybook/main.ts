import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import type { StorybookConfig } from "@storybook/react-vite";
const config: StorybookConfig = {
  stories: [
    "../src/**/*.stories.tsx",
    resolve(
      dirname(
        createRequire(import.meta.url).resolve(
          "@petercoxhatesbridges/extension-ui/stories/input.stories.tsx",
        ),
      ),
      "**/*.stories.tsx",
    ),
  ],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
    "@storybook/addon-vitest",
  ],
  staticDirs: ["../public"],
  framework: {
    name: "@storybook/react-vite",
    options: {
      builder: { viteConfigPath: resolve(".storybook/vite.config.ts") },
    },
  },
};
export default config;
