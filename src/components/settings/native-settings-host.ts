/** Clear Obsidian `Setting` widgets mounted into native host containers. */
export function clearSettingsHosts(...hosts: Array<HTMLElement | null | undefined>): void {
  for (const host of hosts) {
    host?.replaceChildren();
  }
}

/**
 * Run a builder after clearing hosts; returns a dispose that clears again.
 * Use inside Svelte `$effect` for locale/auth-driven Obsidian Setting remounts.
 */
export function mountSettingsHosts(
  hosts: Array<HTMLElement | null | undefined>,
  build: () => void
): () => void {
  clearSettingsHosts(...hosts);
  build();
  return () => clearSettingsHosts(...hosts);
}
