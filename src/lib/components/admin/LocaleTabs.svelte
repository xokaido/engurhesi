<script lang="ts">
  import type { Snippet } from 'svelte';
  import { LOCALES, type Locale } from '$lib/i18n';

  let {
    status = {},
    panel,
    current = $bindable('ka')
  }: {
    /** per-locale review state for the chip: reviewed | human_edited | machine | missing (+stale suffix) */
    status?: Partial<Record<Locale, { reviewStatus: string; stale: boolean }>>;
    panel: Snippet<[Locale]>;
    current?: Locale;
  } = $props();

  function chip(locale: Locale): string {
    const s = status[locale];
    if (!s) return '○';
    if (s.stale) return '⚠';
    switch (s.reviewStatus) {
      case 'reviewed':
        return '✓';
      case 'human_edited':
        return '✎';
      case 'machine':
        return '●';
      default:
        return '○';
    }
  }

  const LABELS: Record<Locale, string> = { ka: 'ქართული', en: 'English', ru: 'Русский' };
</script>

<div class="loc-tabs" role="tablist">
  {#each LOCALES as locale (locale)}
    <button
      type="button"
      role="tab"
      aria-selected={current === locale}
      class:on={current === locale}
      onclick={() => (current = locale)}
    >
      {LABELS[locale]}
      <span class="chip" title={status[locale]?.reviewStatus ?? 'missing'}>{chip(locale)}</span>
    </button>
  {/each}
</div>

{#each LOCALES as locale (locale)}
  <div role="tabpanel" hidden={current !== locale}>
    {@render panel(locale)}
  </div>
{/each}

<style>
  .loc-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: var(--sp-2);
    border-bottom: 2px solid var(--c-line);
  }

  .loc-tabs button {
    border: none;
    background: transparent;
    padding: 0.625rem 1.125rem;
    font-family: inherit;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--c-ink-500);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
  }

  .loc-tabs button:hover {
    color: var(--c-primary-800);
  }

  .loc-tabs button.on {
    color: var(--c-primary-900);
    border-bottom-color: var(--c-accent-500);
  }

  .chip {
    margin-left: 0.375rem;
    font-size: var(--fs-xs);
  }
</style>
