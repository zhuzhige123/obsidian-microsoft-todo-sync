<script lang="ts">
  import { Menu, Notice } from "obsidian";
  import type { ListRouteEntry } from "../../settings/types";
  import type { MtdStrings } from "../../i18n/types";
  import {
    buildSavedRows,
    commitRouteRow,
    defaultRouteDisplayTag,
    entriesFromRows,
    newRouteRowId,
    routesSyncKey,
    validateRouteRow,
    type RouteRow,
    type RouteValidationError,
  } from "./list-route-rows";

  interface Props {
    syncTag: string;
    routes: ListRouteEntry[];
    strings: MtdStrings["sync"];
    onRoutesChange: (routes: ListRouteEntry[]) => void | Promise<void>;
  }

  let { syncTag, routes, strings, onRoutesChange }: Props = $props();

  let rows = $state<RouteRow[]>([]);
  let lastSyncKey = $state("");

  function syncFromProps(): void {
    const key = routesSyncKey(routes, syncTag);
    if (key === lastSyncKey) {
      return;
    }
    const drafts = rows.filter((row) => !row.saved);
    rows = [...buildSavedRows(routes, syncTag), ...drafts];
    lastSyncKey = key;
  }

  $effect(() => {
    syncTag;
    routes;
    syncFromProps();
  });

  function markDirty(rowId: string): void {
    rows = rows.map((item) => (item.id === rowId ? { ...item, saved: false } : item));
  }

  function addRow(): void {
    rows = [
      ...rows,
      {
        id: newRouteRowId(),
        displayTag: defaultRouteDisplayTag(syncTag),
        listName: "",
        saved: false,
      },
    ];
  }

  function validationMessage(kind: RouteValidationError): string {
    if (kind === "list") {
      return strings.listRoutesErrorList;
    }
    if (kind === "duplicate") {
      return strings.listRoutesErrorDuplicate;
    }
    if (kind === "namespace") {
      return strings.listRoutesErrorNamespace;
    }
    return strings.listRoutesErrorTag;
  }

  function showValidationNotice(kind: RouteValidationError): void {
    new Notice(validationMessage(kind));
  }

  async function saveRow(rowId: string): Promise<void> {
    const row = rows.find((item) => item.id === rowId);
    if (!row) {
      return;
    }

    const validationError = validateRouteRow(row, rows, syncTag);
    if (validationError) {
      showValidationNotice(validationError);
      return;
    }

    const committed = commitRouteRow(row, syncTag);
    rows = rows.map((item) => (item.id === rowId ? committed : item));

    const nextRoutes = entriesFromRows(rows, syncTag);
    if (!nextRoutes) {
      showValidationNotice("tag");
      return;
    }

    await onRoutesChange(nextRoutes);
    lastSyncKey = routesSyncKey(nextRoutes, syncTag);
    rows = [
      ...buildSavedRows(nextRoutes, syncTag),
      ...rows.filter((item) => !item.saved && item.id !== rowId),
    ];
  }

  async function deleteRow(rowId: string): Promise<void> {
    const row = rows.find((item) => item.id === rowId);
    if (!row) {
      return;
    }

    rows = rows.filter((item) => item.id !== rowId);

    if (!row.saved) {
      return;
    }

    const nextRoutes = entriesFromRows(rows, syncTag);
    if (!nextRoutes) {
      await onRoutesChange([]);
      lastSyncKey = routesSyncKey([], syncTag);
      return;
    }

    await onRoutesChange(nextRoutes);
    lastSyncKey = routesSyncKey(nextRoutes, syncTag);
    rows = [...buildSavedRows(nextRoutes, syncTag), ...rows.filter((item) => !item.saved)];
  }

  function openRowMenu(event: MouseEvent, rowId: string): void {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle(strings.listRoutesSave).onClick(() => {
        void saveRow(rowId);
      });
    });
    menu.addItem((item) => {
      item
        .setTitle(strings.listRoutesDelete)
        .setWarning(true)
        .onClick(() => {
          void deleteRow(rowId);
        });
    });
    menu.showAtMouseEvent(event);
  }
</script>

<section class="mtd-routes-table-block" aria-labelledby="mtd-routes-table-title">
  <header class="mtd-routes-table-header">
    <h4 id="mtd-routes-table-title" class="mtd-routes-table-title">{strings.listRoutesName}</h4>
    <p class="mtd-routes-table-desc">{strings.listRoutesDesc}</p>
  </header>

  <div class="mtd-routes-table-panel">
    <div class="mtd-routes-grid" role="table" aria-label={strings.listRoutesName}>
      <div class="mtd-routes-grid-row mtd-routes-grid-head" role="row">
        <div class="mtd-routes-grid-cell" role="columnheader">{strings.listRoutesColTag}</div>
        <div class="mtd-routes-grid-cell" role="columnheader">{strings.listRoutesColList}</div>
        <div class="mtd-routes-grid-cell mtd-routes-grid-cell--actions" role="columnheader">
          {strings.listRoutesColActions}
        </div>
      </div>

      {#if rows.length === 0}
        <div class="mtd-routes-grid-empty" role="row">
          <div class="mtd-routes-grid-cell" role="cell">{strings.listRoutesEmpty}</div>
        </div>
      {:else}
        {#each rows as row (row.id)}
          <div
            class="mtd-routes-grid-row"
            class:mtd-routes-grid-row--draft={!row.saved}
            role="row"
          >
            <div class="mtd-routes-grid-cell" role="cell">
              <input
                class="input mtd-routes-grid-input"
                type="text"
                bind:value={row.displayTag}
                placeholder={strings.listRoutesTagPlaceholder}
                spellcheck="false"
                oninput={() => markDirty(row.id)}
              />
            </div>
            <div class="mtd-routes-grid-cell" role="cell">
              <input
                class="input mtd-routes-grid-input"
                type="text"
                bind:value={row.listName}
                placeholder={strings.listRoutesListPlaceholder}
                oninput={() => markDirty(row.id)}
              />
            </div>
            <div class="mtd-routes-grid-cell mtd-routes-grid-cell--actions" role="cell">
              <button
                type="button"
                class="clickable-icon mtd-routes-grid-menu"
                aria-label={strings.listRoutesColActions}
                onclick={(event) => openRowMenu(event, row.id)}
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
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <button type="button" class="mod-cta mtd-routes-table-add" onclick={addRow}>
    {strings.listRoutesNew}
  </button>
</section>
