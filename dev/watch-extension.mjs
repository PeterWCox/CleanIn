import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { build } from "vite";

if (process.env.CLEANIN_PRODUCTION === "1") {
  throw new Error("Extension watch mode requires a development build.");
}

const channel = "cleanin-build";
let latestBuild;
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.CLEANIN_RELOAD_PORT ?? 17016),
  fetch(request, server) {
    const origin = request.headers.get("origin") ?? "";
    if (new URL(request.url).pathname !== "/cleanin-reload" ||
        !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
      return new Response(null, { status: 403 });
    }
    if (server.upgrade(request)) return;
    return new Response(null, { status: 426 });
  },
  websocket: {
    open(socket) {
      socket.subscribe(channel);
      if (latestBuild) socket.send(latestBuild);
    },
    message() {},
  },
});

const reloadUrl = `ws://127.0.0.1:${server.port}/cleanin-reload`;
const workerPath = resolve("dev/reload-worker.js");
const publicDir = resolve("public");
const heartbeat = setInterval(() => {
  if (latestBuild) server.publish(channel, latestBuild);
}, 15_000);

try {
  await build({
    build: {
      watch: { clearScreen: false },
      outDir: process.env.CLEANIN_DEV_OUT_DIR,
    },
    plugins: [{
      name: "cleanin-development-reload",
      async buildStart() {
        this.addWatchFile(workerPath);
        for (const entry of await readdir(publicDir, { recursive: true, withFileTypes: true })) {
          if (entry.isFile()) this.addWatchFile(resolve(entry.parentPath, entry.name));
        }
      },
      writeBundle: {
        order: "post",
        sequential: true,
        async handler(output) {
          const revision = randomUUID();
          const worker = await readFile(workerPath, "utf8");
          const manifestPath = resolve(output.dir, "manifest.json");
          const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
          manifest.background.service_worker = "dev-background.js";
          manifest.minimum_chrome_version = String(Math.max(Number(manifest.minimum_chrome_version ?? 116), 116));
          await writeFile(resolve(output.dir, "dev-background.js"),
            `importScripts("background.js");\n${worker}\nwatchCleanInBuilds(${JSON.stringify(reloadUrl)}, ${JSON.stringify(revision)});\n`);
          await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
          latestBuild = revision;
          server.publish(channel, revision);
          console.log(`CleanIn reload ready on ${reloadUrl}`);
        },
      },
    }],
  });
} catch (error) {
  clearInterval(heartbeat);
  server.stop(true);
  throw error;
}
