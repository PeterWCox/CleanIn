import { readFileSync } from "node:fs";
export const extensionVersion: string = JSON.parse(
  readFileSync(new URL("./public/manifest.json", import.meta.url), "utf8"),
).version;
