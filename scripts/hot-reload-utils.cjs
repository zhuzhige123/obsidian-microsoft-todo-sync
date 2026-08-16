const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_RUNTIME_FILES = new Set(["main.js", "main.js.map", "styles.css", "styles.css.map", "manifest.json"]);
const DEFAULT_PRUNABLE_RUNTIME_FILES = new Set(["main.js", "main.js.map", "styles.css", "styles.css.map", "manifest.json"]);

function parseDotEnv(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function readEnvValueFromDotEnv(key) {
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) return null;
  try {
    const parsed = parseDotEnv(fs.readFileSync(envPath, "utf8"));
    const value = parsed[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function resolveVaultPath(processEnv = process.env) {
  return processEnv.OBSIDIAN_VAULT_PATH?.trim() || readEnvValueFromDotEnv("OBSIDIAN_VAULT_PATH");
}

function resolveHotReloadPluginId(processEnv = process.env) {
  return (
    processEnv.OBSIDIAN_PLUGIN_ID?.trim() ||
    readEnvValueFromDotEnv("OBSIDIAN_PLUGIN_ID") ||
    "obsidian-microsoft-todo-sync"
  );
}

function resolvePluginDir(pluginId, processEnv = process.env) {
  const vaultPath = resolveVaultPath(processEnv);
  if (!vaultPath) return null;
  return path.resolve(vaultPath, ".obsidian", "plugins", pluginId);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function copyFileAtomicWithRetry(sourceFile, targetFile, { retries = 24, delayMs = 180 } = {}) {
  if (path.resolve(sourceFile) === path.resolve(targetFile)) return false;
  const tempFile = path.join(
    path.dirname(targetFile),
    `.mtd-sync-${process.pid}-${Date.now()}-${path.basename(targetFile)}`
  );

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.copyFileSync(sourceFile, tempFile);
      if (fs.existsSync(targetFile)) fs.rmSync(targetFile, { force: true });
      fs.renameSync(tempFile, targetFile);
      return true;
    } catch (error) {
      try {
        if (fs.existsSync(tempFile)) fs.rmSync(tempFile, { force: true });
      } catch {}
      const code = error?.code;
      if (["EBUSY", "EPERM", "ENOTEMPTY", "EMFILE", "ENOENT"].includes(code) && attempt < retries) {
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }
  return false;
}

function pruneManagedRuntimeFiles(targetDir, keepFiles = new Set(), managedFiles = DEFAULT_PRUNABLE_RUNTIME_FILES) {
  if (!fs.existsSync(targetDir)) return [];
  const removed = [];
  for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (!entry.isFile() || !managedFiles.has(entry.name) || keepFiles.has(entry.name)) continue;
    fs.rmSync(path.join(targetDir, entry.name), { force: true });
    removed.push(entry.name);
  }
  return removed.sort((a, b) => a.localeCompare(b));
}

async function syncRuntimeFiles(sourceDir, targetDir, { runtimeFiles = DEFAULT_RUNTIME_FILES, pruneStaleManagedFiles = false } = {}) {
  const runtimeFilesList = fs.existsSync(sourceDir)
    ? fs
        .readdirSync(sourceDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && runtimeFiles.has(entry.name))
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b))
    : [];
  const copied = [];
  for (const fileName of runtimeFilesList) {
    const copiedFile = await copyFileAtomicWithRetry(path.join(sourceDir, fileName), path.join(targetDir, fileName));
    if (copiedFile) copied.push(fileName);
  }
  const removed = pruneStaleManagedFiles
    ? pruneManagedRuntimeFiles(targetDir, new Set(runtimeFilesList), DEFAULT_PRUNABLE_RUNTIME_FILES)
    : [];
  return { runtimeFiles: runtimeFilesList, copied, removed };
}

module.exports = {
  DEFAULT_PRUNABLE_RUNTIME_FILES,
  DEFAULT_RUNTIME_FILES,
  PROJECT_ROOT,
  copyFileAtomicWithRetry,
  pruneManagedRuntimeFiles,
  resolveHotReloadPluginId,
  resolvePluginDir,
  resolveVaultPath,
  syncRuntimeFiles,
};
