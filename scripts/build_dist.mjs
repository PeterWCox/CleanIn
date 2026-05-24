import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repo = resolve(__dirname, "..");
const sourceDir = resolve(repo, "extension-src");
const outDir = resolve(repo, "dist");

const iconPaths = {
  "16": "icons/icon16.png",
  "32": "icons/icon32.png",
  "48": "icons/icon48.png",
  "64": "icons/icon64.png",
  "128": "icons/icon128.png",
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(sourceDir, outDir, { recursive: true });

const manifestPath = resolve(outDir, "manifest.json");
if (!existsSync(manifestPath)) {
  throw new Error(`Missing ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.name = "CleanIn - Hide LinkedIn promoted and suggested posts";
manifest.short_name = "CleanIn";
manifest.action = {
  ...(manifest.action ?? {}),
  default_title: "CleanIn",
  default_icon: iconPaths,
};
manifest.icons = iconPaths;

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote ${outDir}`);
