<script lang="ts">
  import type { TabDefinition } from "../../types/tab";

  interface Props {
    tabs: TabDefinition[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    variant?: "default" | "plain";
  }

  let { tabs, activeTab, onTabChange, variant = "plain" }: Props = $props();

  function handleKeyDown(event: KeyboardEvent): void {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex === -1) {
      return;
    }

    let newIndex = currentIndex;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
    } else {
      return;
    }

    const nextTab = tabs[newIndex];
    if (nextTab && !nextTab.disabled) {
      onTabChange(nextTab.id);
    }
  }
</script>

<div
  class="tab-navigation"
  class:tab-navigation--plain={variant === "plain"}
  role="tablist"
  tabindex="0"
  onkeydown={handleKeyDown}
>
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      class="tab-button"
      class:active={activeTab === tab.id}
      class:disabled={tab.disabled}
      role="tab"
      aria-selected={activeTab === tab.id}
      aria-controls={tab.panelId}
      aria-disabled={tab.disabled}
      tabindex={activeTab === tab.id ? 0 : -1}
      disabled={tab.disabled}
      onclick={() => onTabChange(tab.id)}
    >
      {#if tab.label}
        <span class="tab-label">{tab.label}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .tab-navigation {
    display: flex;
    background: var(--background-secondary);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }

  .tab-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 14px;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
    white-space: nowrap;
  }

  .tab-button:hover:not(.disabled) {
    color: var(--text-normal);
  }

  .tab-button.active {
    background: var(--background-primary);
    color: var(--text-normal);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .tab-button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: -2px;
  }

  .tab-button.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .tab-label {
    white-space: nowrap;
  }

  .tab-navigation--plain {
    background: transparent;
    border-radius: 0;
    padding: 0;
    gap: 0.35rem;
  }

  .tab-navigation--plain .tab-button {
    border-radius: var(--radius-s, 8px);
    padding: 0.45rem 0.85rem;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--font-ui-small, 0.95rem);
    box-shadow: none;
  }

  .tab-navigation--plain .tab-button:hover:not(.disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .tab-navigation--plain .tab-button.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: none;
  }

  .tab-navigation--plain .tab-button.active:hover:not(.disabled) {
    background: var(--interactive-accent-hover, var(--interactive-accent));
    color: var(--text-on-accent);
  }

  .tab-navigation--plain .tab-button:focus-visible {
    outline-offset: 2px;
  }

  @media (max-width: 600px) {
    .tab-label {
      font-size: var(--font-ui-small);
    }

    .tab-button {
      padding: 5px 10px;
      gap: 4px;
    }

    .tab-navigation--plain .tab-button {
      padding: 0.45rem 0.75rem;
    }
  }
</style>
