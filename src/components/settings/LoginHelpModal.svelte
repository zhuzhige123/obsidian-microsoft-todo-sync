<script lang="ts">
  import type { MtdStrings } from "../../i18n/types";

  interface Props {
    open: boolean;
    strings: MtdStrings["account"]["loginHelp"];
    onClose: () => void;
  }

  let { open, strings, onClose }: Props = $props();

  function handleKeydown(event: KeyboardEvent): void {
    if (!open || event.key !== "Escape") {
      return;
    }
    onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="mtd-login-help-backdrop" role="presentation" onclick={onClose}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
      class="mtd-login-help-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mtd-login-help-title"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
    >
      <header class="mtd-login-help-header">
        <h3 id="mtd-login-help-title" class="mtd-login-help-title">{strings.title}</h3>
        <button type="button" class="clickable-icon mtd-login-help-close" aria-label={strings.close} onclick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div class="mtd-login-help-body">
        {#each strings.items as item (item.question)}
          <article class="mtd-login-help-item">
            <h4 class="mtd-login-help-question">{item.question}</h4>
            <p class="mtd-login-help-answer">{item.answer}</p>
          </article>
        {/each}
      </div>
    </div>
  </div>
{/if}
