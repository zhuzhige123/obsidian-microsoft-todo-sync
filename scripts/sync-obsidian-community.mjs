#!/usr/bin/env node
/**
 * Export Obsidian community-review subset to .community-export/ and optionally
 * push to a public GitHub remote for plugin review.
 */
import { execSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportDir = path.join(root, ".community-export");
const manifestPath = path.join(root, "scripts", "obsidian-community-files.json");

function loadManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

function listTrackedFiles() {
  const out = execSync("git ls-files -z", { cwd: root, encoding: "buffer" });
  return out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((f) => f.replace(/\\/g, "/"));
}

function segmentMatch(segment, globPart) {
  if (globPart === "*") return true;
  if (!globPart.includes("*")) return segment === globPart;
  const re = new RegExp(
    "^" + globPart.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$",
  );
  return re.test(segment);
}

function matchParts(pattern, file, pi, fi) {
  if (pi === pattern.length) return fi === file.length;
  const p = pattern[pi];
  if (p === "**") {
    for (let skip = fi; skip <= file.length; skip++) {
      if (matchParts(pattern, file, pi + 1, skip)) return true;
    }
    return false;
  }
  if (fi >= file.length || !segmentMatch(file[fi], p)) return false;
  return matchParts(pattern, file, pi + 1, fi + 1);
}

function pathGlobMatch(file, pattern) {
  const parts = pattern.replace(/\\/g, "/").split("/");
  const fileParts = file.replace(/\\/g, "/").split("/");
  return matchParts(parts, fileParts, 0, 0);
}

function matchesAny(file, patterns) {
  return patterns.some((pat) => pathGlobMatch(file, pat));
}

function collectExportFiles(manifest) {
  const tracked = listTrackedFiles();
  const untrackedSrc = [];
  try {
    for (const line of execSync("git ls-files -o --exclude-standard src/", {
      cwd: root,
      encoding: "utf8",
    }).split("\n")) {
      if (line.trim()) untrackedSrc.push(line.trim().replace(/\\/g, "/"));
    }
  } catch {
    // ignore
  }
  const pool = [...new Set([...tracked, ...untrackedSrc])];
  return pool
    .filter(
      (f) => matchesAny(f, manifest.include) && !matchesAny(f, manifest.exclude ?? []),
    )
    .sort();
}

function gitInExport(args, options = {}) {
  const r = spawnSync("git", args, {
    cwd: exportDir,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });
  if (r.status !== 0 && !options.allowFail) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
  }
  return (r.stdout || "").trim();
}

function writeExport(files) {
  rmSync(exportDir, { recursive: true, force: true });
  mkdirSync(exportDir, { recursive: true });
  for (const rel of files) {
    const src = path.join(root, rel);
    const dest = path.join(exportDir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest);
  }
  writeFileSync(
    path.join(exportDir, ".community-export-manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2) + "\n",
  );
  console.log(`[sync:obsidian-community] Exported ${files.length} file(s) → .community-export/`);
}

function pushCommunity(remote, branch, message) {
  if (!existsSync(path.join(exportDir, ".git"))) {
    gitInExport(["init"]);
    gitInExport(["branch", "-M", branch]);
  }

  gitInExport(["add", "-A"]);
  const status = gitInExport(["status", "--porcelain"]);
  if (!status) {
    console.log("[sync:obsidian-community] No changes to push.");
    return;
  }
  gitInExport(["commit", "-m", message]);
  gitInExport(["remote", "remove", "community"], { allowFail: true });
  gitInExport(["remote", "add", "community", remote]);
  gitInExport(["push", "-u", "community", branch, "--force"], { stdio: "inherit" });
  console.log(`[sync:obsidian-community] Pushed to ${remote} (${branch})`);
}

function main() {
  const args = process.argv.slice(2);
  const push = args.includes("--push");
  const remote =
    args.find((a) => a.startsWith("--remote="))?.slice("--remote=".length) ??
    process.env.MTD_COMMUNITY_REMOTE;
  const branch =
    args.find((a) => a.startsWith("--branch="))?.slice("--branch=".length) ?? "main";
  const message =
    args.find((a) => a.startsWith("--message="))?.slice("--message=".length) ??
    `chore: sync obsidian community export ${new Date().toISOString().slice(0, 10)}`;

  const manifest = loadManifest();
  const files = collectExportFiles(manifest);
  writeExport(files);

  if (push) {
    if (!remote) {
      console.error(
        "Missing community remote. Use --remote=git@github.com:USER/obsidian-microsoft-todo-sync.git\n" +
          "or set MTD_COMMUNITY_REMOTE.",
      );
      process.exit(1);
    }
    pushCommunity(remote, branch, message);
  } else {
    console.log(
      "Dry export only. To push public community repo:\n" +
        "  npm run sync:obsidian-community -- --push --remote=<public-repo-url>",
    );
  }
}

main();
