# Microsoft To Do Sync (Obsidian plugin)

Selective two-way sync between Obsidian tasks and a dedicated Microsoft To Do list.

## Status

**Phase 0 scaffold** — settings UI, project tooling, and architecture docs. Sync engine and Microsoft sign-in ship in Phase 1.

## Development

```bash
cd obsidian-microsoft-todo-sync
npm install
npm run dev
```

Link or copy this folder into your vault `.obsidian/plugins/obsidian-microsoft-todo-sync/` (with `main.js`, `manifest.json`, `styles.css`).

```bash
npm run build      # production main.js
npm run verify:community
```

## Stack

- TypeScript
- Svelte 5 (settings panel only)
- Vite (bundle to `main.js`)
- Vitest + eslint-plugin-obsidianmd

## Git remotes

| Remote | Purpose |
|--------|---------|
| `origin` | **Private** GitHub repo — plugin source and tooling |
| Public URL (later) | Obsidian community review — via `npm run sync:obsidian-community` |

**Never pushed** (local only, see `.gitignore`): `docs/`, `.cursor/`, `AGENTS.md`, `.env`, dev `*.cjs` scripts, build artifacts.

```bash
# First time (after gh auth login):
npm run setup:private-remote

npm run check:private-push    # before git push origin
npm run push:private          # guard + push to private origin

# Export community-review subset (no dev docs); add --push when public repo exists:
npm run sync:obsidian-community
npm run sync:obsidian-community -- --push --remote=git@github.com:YOU/obsidian-microsoft-todo-sync.git
```

## License

GPL-3.0-or-later
