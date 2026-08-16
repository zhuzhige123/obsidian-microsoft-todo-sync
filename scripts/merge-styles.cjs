const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const BASE_STYLES_PATH = path.join(PROJECT_ROOT, "styles.css");
/** Marks the start of Vite/Svelte-injected styles; everything after is replaced each build. */
const SVELTE_STYLES_MARKER = "/* --- svelte-component-styles --- */\n";

function readHandWrittenStyles() {
  if (!fs.existsSync(BASE_STYLES_PATH)) {
    return "";
  }
  const content = fs.readFileSync(BASE_STYLES_PATH, "utf8");
  const markerIndex = content.indexOf(SVELTE_STYLES_MARKER);
  if (markerIndex >= 0) {
    return content.slice(0, markerIndex).trimEnd();
  }
  const legacyBundleIndex = content.search(/\n\.[\w-]+\.svelte-\w+\{/);
  if (legacyBundleIndex >= 0) {
    return content.slice(0, legacyBundleIndex).trimEnd();
  }
  return content.trimEnd();
}

function mergeStyles(targetDir = PROJECT_ROOT) {
  const bundlePath = path.join(targetDir, "styles.bundle.css");
  const outputPath = path.join(targetDir, "styles.css");
  const base = readHandWrittenStyles();
  const bundle = fs.existsSync(bundlePath) ? fs.readFileSync(bundlePath, "utf8").trim() : "";
  const merged = bundle ? `${base}\n\n${SVELTE_STYLES_MARKER}${bundle}\n` : `${base}\n`;
  fs.writeFileSync(outputPath, merged);
  if (bundle && fs.existsSync(bundlePath)) {
    fs.unlinkSync(bundlePath);
  }
}

module.exports = { mergeStyles, readHandWrittenStyles, SVELTE_STYLES_MARKER };

if (require.main === module) {
  const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : PROJECT_ROOT;
  mergeStyles(targetDir);
}
