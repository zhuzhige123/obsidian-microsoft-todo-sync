#!/usr/bin/env node
/**
 * Pre-push guard for the private GitHub remote.
 * Blocks local-only dev docs and Obsidian community export paths.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BLOCKED_PREFIXES = ["docs/", ".cursor/", ".community-export/"];
const BLOCKED_EXACT = new Set([
  "AGENTS.md",
  ".env",
  "main.js",
  "main.js.map",
  "styles.bundle.css",
]);

const BLOCKED_GLOBS = [
  /^\.env\./,
  /^\.desktop-hot-reload\//,
  /^node_modules\//,
  /\.cjs$/,
  /\.log$/,
];

function listStagedAndCommittedAhead(remoteRef) {
  const files = new Set();
  try {
    for (const line of execSync(`git diff --cached --name-only --diff-filter=ACMRT`, {
      cwd: root,
      encoding: "utf8",
    }).split("\n")) {
      if (line.trim()) files.add(line.trim().replace(/\\/g, "/"));
    }
  } catch {
    // no staged
  }
  if (remoteRef) {
    try {
      execSync(`git fetch ${remoteRef.split("/")[0]}`, { cwd: root, stdio: "ignore" });
      const range = `${remoteRef}..HEAD`;
      for (const line of execSync(`git diff --name-only ${range}`, {
        cwd: root,
        encoding: "utf8",
      }).split("\n")) {
        if (line.trim()) files.add(line.trim().replace(/\\/g, "/"));
      }
    } catch {
      // first push or missing remote
    }
  }
  return [...files];
}

function isBlocked(relPath) {
  const normalized = relPath.replace(/\\/g, "/");
  if (BLOCKED_EXACT.has(normalized)) return normalized;
  for (const prefix of BLOCKED_PREFIXES) {
    if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) {
      return normalized;
    }
  }
  for (const re of BLOCKED_GLOBS) {
    if (re.test(normalized)) return normalized;
  }
  return null;
}

function scanSecrets() {
  try {
    const out = execSync('git grep -l "BEGIN PRIVATE KEY" HEAD', {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (out) return out.split("\n");
  } catch {
    // no matches
  }
  return [];
}

export function runPrivatePushGuard(options = {}) {
  const remoteRef = options.remoteRef ?? "origin/main";
  const files = listStagedAndCommittedAhead(remoteRef);
  const blocked = files.map((f) => isBlocked(f)).filter(Boolean);
  const secrets = scanSecrets();

  if (blocked.length > 0) {
    console.error("\n[private-push-guard] 以下路径禁止推送到私密仓：\n");
    for (const f of blocked) console.error(`  - ${f}`);
    console.error(
      "\n开发文档与 Cursor 规则应仅保留本地（见 .gitignore）。\n" +
        "Obsidian 社区审核请使用：npm run sync:obsidian-community\n",
    );
    process.exit(1);
  }

  if (secrets.length > 0) {
    console.error("\n[private-push-guard] 检测到疑似私钥内容，禁止推送：\n");
    for (const f of secrets) console.error(`  - ${f}`);
    process.exit(1);
  }

  if (options.verbose) {
    console.log(`[private-push-guard] OK (${files.length} file(s) in push scope)`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPrivatePushGuard({ verbose: true, remoteRef: process.argv[2] ?? "origin/main" });
}
