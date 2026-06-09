#!/usr/bin/env node
/**
 * One-time setup: create private GitHub repo and set origin.
 * Requires: gh auth login
 *
 *   node scripts/setup-private-remote.mjs
 *   node scripts/setup-private-remote.mjs --name my-private-fork
 */
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: root, encoding: "utf8", stdio: options.inherit ? "inherit" : "pipe" }).trim();
}

function gh(args, inherit = false) {
  const r = spawnSync("gh", args, { cwd: root, encoding: "utf8", stdio: inherit ? "inherit" : "pipe" });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `gh ${args.join(" ")} failed`).trim());
  }
  return (r.stdout || "").trim();
}

function main() {
  const args = process.argv.slice(2);
  const name =
    args.find((a) => a.startsWith("--name="))?.slice("--name=".length) ??
    "obsidian-microsoft-todo-sync-private";
  const description = "Private development repo for Microsoft To Do Sync Obsidian plugin";

  try {
    gh(["auth", "status"]);
  } catch {
    console.error("请先运行：gh auth login");
    process.exit(1);
  }

  let existing = "";
  try {
    existing = run("git remote get-url origin", { inherit: false });
  } catch {
    // no origin yet
  }
  if (existing) {
    console.log(`origin 已存在：${existing}`);
    console.log("若要重建远程，请先：git remote remove origin");
    process.exit(0);
  }

  console.log(`创建私密仓库：${name}`);
  const url = gh([
    "repo",
    "create",
    name,
    "--private",
    "--source=.",
    "--remote=origin",
    "--description",
    description,
    "--push",
  ], true);

  run("npm run check:private-push", { inherit: true });
  console.log("\n私密仓已就绪。日后推送请使用：npm run push:private");
  if (url) console.log(url);
}

main();
