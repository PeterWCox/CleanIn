import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type TargetConfig = {
  displayName: string;
  shortName: string;
  outputDirName: string;
};

const TARGET_CONFIG = {
  displayName: "CleanIn - Hide LinkedIn promoted and suggested posts",
  shortName: "CleanIn",
  outputDirName: "dist",
} as const satisfies TargetConfig;

export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";
  const outDir = resolve(__dirname, TARGET_CONFIG.outputDirName);

  return {
    plugins: [copyExtensionPackage(TARGET_CONFIG, outDir)],
    build: {
      outDir,
      emptyOutDir: true,
      minify: isProduction ? "esbuild" : false,
      sourcemap: false,
      rollupOptions: {
        input: resolve(__dirname, "vite-entry.js"),
      },
    },
  };
});

function copyExtensionPackage(targetConfig: TargetConfig, outDir: string): Plugin {
  return {
    name: "copy-cleanin-extension",
    closeBundle() {
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });

      const sourceDir = resolve(__dirname, "extension-src");
      cpSync(sourceDir, outDir, { recursive: true });

      writeTargetManifest(outDir, targetConfig);
    },
  };
}

function writeTargetManifest(outDir: string, targetConfig: TargetConfig) {
  const manifestPath = resolve(outDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    action?: {
      default_title?: string;
      default_icon?: Record<string, string>;
    };
    icons?: Record<string, string>;
    name?: string;
    short_name?: string;
  };

  const iconPaths = {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "64": "icons/icon64.png",
    "128": "icons/icon128.png",
  };

  manifest.name = targetConfig.displayName;
  manifest.short_name = targetConfig.shortName;
  manifest.action = {
    ...(manifest.action ?? {}),
    default_title: targetConfig.shortName,
    default_icon: iconPaths,
  };
  manifest.icons = iconPaths;

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
