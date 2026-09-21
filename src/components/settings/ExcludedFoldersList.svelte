<script lang="ts">
  import { Notice } from "obsidian";
  import { untrack } from "svelte";
  import { formatString } from "../../i18n";
  import type { MtdStrings } from "../../i18n/types";
  import type MicrosoftTodoSyncPlugin from "../../main";
  import { commitExcludedFolder } from "../../vault/excluded-folders";
  import { FolderSuggest, resolveVaultFolder } from "./folder-suggest";

  interface Props {
    plugin: MicrosoftTodoSyncPlugin;
    folders: string[];
    strings: MtdStrings["sync"];
    onFoldersChange: (folders: string[]) => void | Promise<void>;
  }

  let { plugin, folders, strings, onFoldersChange }: Props = $props();

  let draftPath = $state("");
  let items = $state<string[]>(untrack(() => [...folders]));
  let addInputEl = $state<HTMLInputElement | null>(null);
  let folderSuggest: FolderSuggest | null = null;

  $effect(() => {
    items = [...folders];
  });

  function currentDraft(): string {
    return folderSuggest?.getValue() || addInputEl?.value || draftPath;
  }

  function clearDraft(): void {
    draftPath = "";
    if (addInputEl) {
      addInputEl.value = "";
    }
    folderSuggest?.close();
  }

  function applyDraft(path: string): void {
    draftPath = path;
    if (addInputEl && addInputEl.value !== path) {
      addInputEl.value = path;
    }
  }

  async function addFolder(): Promise<void> {
    const typed = currentDraft();
    const folder = resolveVaultFolder(plugin.app, typed);
    if (!folder) {
      const message = typed.trim()
        ? strings.excludedFoldersErrorMissing
        : strings.excludedFoldersErrorEmpty;
      new Notice(message);
      return;
    }

    const result = commitExcludedFolder(items, folder.path);
    if (result.status === "duplicate") {
      new Notice(strings.excludedFoldersErrorDuplicate);
      return;
    }
    if (result.status === "covered") {
      new Notice(formatString(strings.excludedFoldersErrorCovered, { folder: result.by }));
      return;
    }
    if (result.status !== "added") {
      new Notice(strings.excludedFoldersErrorEmpty);
      return;
    }

    clearDraft();
    items = result.folders;
    await onFoldersChange(result.folders);
  }

  async function removeFolder(path: string): Promise<void> {
    const next = items.filter((item) => item !== path);
    items = next;
    await onFoldersChange(next);
  }

  function onAddKeydown(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.isComposing) {
      return;
    }
    if (folderSuggest?.isChooserOpen()) {
      return;
    }
    event.preventDefault();
    void addFolder();
  }

  $effect(() => {
    const input = addInputEl;
    if (!input) {
      return;
    }
    folderSuggest?.close();
    folderSuggest = new FolderSuggest(
      plugin.app,
      input,
      () => items,
      (folder) => {
        applyDraft(folder.path);
      }
    );
    return () => {
      folderSuggest?.close();
      folderSuggest = null;
    };
  });
</script>

<div class="mtd-excluded-folders">
  {#if items.length === 0}
    <p class="mtd-excluded-folders-empty">{strings.excludedFoldersEmpty}</p>
  {:else}
    <div class="mtd-excluded-folders-list" role="list" aria-label={strings.excludedFoldersName}>
      {#each items as folder (folder)}
        <div class="mtd-excluded-folders-row setting-item" role="listitem">
          <span class="mtd-excluded-folders-path" title={folder}>{folder}</span>
          <button
            type="button"
            class="clickable-icon mtd-excluded-folders-remove"
            aria-label={`${strings.excludedFoldersRemove} ${folder}`}
            onclick={() => void removeFolder(folder)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mtd-excluded-folders-add-row setting-item">
    <input
      class="input mtd-excluded-folders-input"
      type="text"
      bind:this={addInputEl}
      bind:value={draftPath}
      placeholder={strings.excludedFoldersPlaceholder}
      spellcheck="false"
      aria-label={strings.excludedFoldersPlaceholder}
      onkeydown={onAddKeydown}
    />
    <button
      type="button"
      class="mod-cta mtd-excluded-folders-add"
      onmousedown={(event) => event.preventDefault()}
      onclick={() => void addFolder()}
    >
      {strings.excludedFoldersAdd}
    </button>
  </div>
</div>
