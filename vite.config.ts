import { builtinModules } from "node:module";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
const require = createRequire(import.meta.url);
const { mergeStyles } = require("./scripts/merge-styles.cjs");
const {
  copyFileAtomicWithRetry,
  DEFAULT_PRUNABLE_RUNTIME_FILES,
  pruneManagedRuntimeFiles,
  resolveHotReloadPluginId,
  resolvePluginDir,
  syncRuntimeFiles,
} = require("./scripts/hot-reload-utils.cjs");

const builtins = [
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function waitForFiles(filePaths: string[], timeoutMs = 4000, intervalMs = 120): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (filePaths.every((filePath) => fs.existsSync(filePath))) {
      return true;
    }
    await sleep(intervalMs);
  }
  return filePaths.every((filePath) => fs.existsSync(filePath));
}

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  const usePollingWatcher = process.platform === "win32";
  const isDesktopHotReload = process.env.MTD_DESKTOP_HOT_RELOAD === "1";
  const pluginId = resolveHotReloadPluginId(process.env);
  const targetPluginDir = resolvePluginDir(pluginId, process.env);
  const stagingDir = process.env.MTD_DESKTOP_SOURCE_DIR?.trim()
    ? path.resolve(process.env.MTD_DESKTOP_SOURCE_DIR)
    : path.resolve(process.cwd(), ".desktop-hot-reload");
  const buildOutDir = isDesktopHotReload && targetPluginDir ? stagingDir : ".";
  const displayOutputDir = isDesktopHotReload && targetPluginDir ? targetPluginDir : buildOutDir;
  let buildWatchAnnounced = false;

  if (isDev) {
    console.log(`[vite] mode: ${mode}`);
    if (isDesktopHotReload && targetPluginDir) {
      console.log(`[vite] staging: ${stagingDir}`);
      console.log(`[vite] target: ${targetPluginDir}`);
    } else {
      console.log(`[vite] output: ${buildOutDir}`);
    }
  }

  return {
    plugins: [
      {
        name: "build-monitor",
        buildStart() {
          if (!isDev || buildWatchAnnounced) return;
          buildWatchAnnounced = true;
          console.log("[watch] development build watcher started");
          console.log(`[watch] backend: ${usePollingWatcher ? "polling" : "fs-events"}`);
        },
        buildEnd() {
          if (!isDev) return;
          const timestamp = new Date().toLocaleTimeString("zh-CN");
          console.log(`[build] finished [${timestamp}]`);
        },
        watchChange(id, change) {
          if (isDev && id) {
            console.log(`[watch] ${path.basename(id)} (${change.event})`);
          }
        },
      },
      svelte(),
      {
        name: "copy-manifest",
        async writeBundle() {
          const manifestSource = path.resolve(process.cwd(), "manifest.json");
          const manifestTarget = path.resolve(buildOutDir, "manifest.json");
          try {
            await copyFileAtomicWithRetry(manifestSource, manifestTarget, { retries: 8, delayMs: 120 });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[manifest-copy] failed: ${message}`);
          }
        },
      },
      {
        name: "merge-styles",
        closeBundle() {
          mergeStyles(buildOutDir);
        },
      },
      {
        name: "desktop-hot-reload-sync",
        buildStart() {
          if (!isDesktopHotReload || !targetPluginDir || buildOutDir === targetPluginDir) return;
          fs.mkdirSync(buildOutDir, { recursive: true });
          pruneManagedRuntimeFiles(buildOutDir, new Set(), DEFAULT_PRUNABLE_RUNTIME_FILES);
        },
        async closeBundle() {
          if (!isDesktopHotReload || !targetPluginDir || buildOutDir === targetPluginDir) return;
          try {
            const expectedFiles = [
              path.join(buildOutDir, "main.js"),
              path.join(buildOutDir, "styles.css"),
              path.join(buildOutDir, "manifest.json"),
            ];
            const filesReady = await waitForFiles(expectedFiles);
            if (!filesReady) {
              const missing = expectedFiles
                .filter((filePath) => !fs.existsSync(filePath))
                .map((filePath) => path.basename(filePath));
              console.warn(`[desktop-sync] missing before sync: ${missing.join(", ")}`);
            }
            const { runtimeFiles, removed } = await syncRuntimeFiles(buildOutDir, targetPluginDir, {
              pruneStaleManagedFiles: true,
            });
            const timestamp = new Date().toLocaleTimeString("zh-CN");
            console.log(
              `[desktop-sync] synced ${runtimeFiles.length} file(s) to ${targetPluginDir} [${timestamp}]`
            );
            if (removed.length > 0) {
              console.log(`[desktop-sync] removed stale: ${removed.join(", ")}`);
            }
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(`[desktop-sync] failed: ${message}`);
          }
        },
      },
    ],
    build: {
      lib: {
        entry: "src/main.ts",
        formats: ["cjs"],
        fileName: () => "main.js",
      },
      rollupOptions: {
        external: [
          "obsidian",
          "electron",
          "@codemirror/autocomplete",
          "@codemirror/collab",
          "@codemirror/commands",
          "@codemirror/language",
          "@codemirror/lint",
          "@codemirror/search",
          "@codemirror/state",
          "@codemirror/view",
          "@lezer/common",
          "@lezer/highlight",
          "@lezer/lr",
          /^@codemirror\/.*/,
          /^@lezer\/.*/,
          ...builtins,
        ],
        output: {
          exports: "default",
          inlineDynamicImports: true,
          entryFileNames: "main.js",
          assetFileNames: "styles.bundle.css",
          sourcemapBaseUrl: isDev ? `file:///${displayOutputDir.replace(/\\/g, "/")}/` : undefined,
        },
      },
      outDir: buildOutDir,
      emptyOutDir: false,
      sourcemap: isDev ? "inline" : false,
      target: "es2018",
      minify: !isDev,
      ...(isDev && {
        watch: {
          include: ["src/**", "styles.css", "manifest.json"],
          exclude: ["node_modules/**", "**/*.test.*", ".git/**", ".desktop-hot-reload/**"],
          buildDelay: 120,
          chokidar: {
            usePolling: usePollingWatcher,
            interval: usePollingWatcher ? 220 : undefined,
            binaryInterval: usePollingWatcher ? 360 : undefined,
            awaitWriteFinish: {
              stabilityThreshold: 240,
              pollInterval: 80,
            },
            ignoreInitial: true,
          },
        },
      }),
    },
  };
});
