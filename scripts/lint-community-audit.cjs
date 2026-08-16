/**
 * Community review gate: zero errors and zero warnings on production sources,
 * manifest.json, and LICENSE; forbidden eslint-disable directives must be absent.
 */
const { spawnSync } = require("node:child_process");

const result = spawnSync(process.execPath, ["scripts/run-obsidian-community-lint.cjs"], {
  stdio: "inherit",
  shell: false,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
