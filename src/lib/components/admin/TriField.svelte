<script lang="ts">
  import { requestTranslation } from './translate-client';

  /**
   * One trilingual value as three inputs (<name>_ka / _en / _ru) plus an
   * instant AJAX translate button that fills EN/РУ from the Georgian value
   * without reloading the page. Blank EN/РУ are also machine-translated
   * server-side on save as a fallback.
   */
  let {
    name,
    ka = '',
    en = '',
    ru = '',
    requiredKa = true,
    placeholder = ''
  }: {
    name: string;
    ka?: string;
    en?: string;
    ru?: string;
    requiredKa?: boolean;
    placeholder?: string;
  } = $props();

  let kaEl: HTMLInputElement | undefined = $state();
  let enEl: HTMLInputElement | undefined = $state();
  let ruEl: HTMLInputElement | undefined = $state();
  let busy = $state(false);
  let error = $state('');

  async function translate() {
    error = '';
    const source = kaEl?.value.trim() ?? '';
    if (!source) {
      error = 'ჯერ ქართული ველი შეავსეთ';
      return;
    }
    const csrf =
      kaEl?.closest('form')?.querySelector<HTMLInputElement>('input[name="csrf"]')?.value ?? '';
    busy = true;
    const res = await requestTranslation(csrf, { fields: { v: source } });
    busy = false;
    if (!res.ok || !res.en || !res.ru) {
      error = res.error ?? 'თარგმნა ვერ შესრულდა';
      return;
    }
    if (enEl && res.en.fields.v) enEl.value = res.en.fields.v;
    if (ruEl && res.ru.fields.v) ruEl.value = res.ru.fields.v;
  }
</script>

<div class="tri-field">
  <label class="tri-cell">
    <span class="lang-tag">ქა</span>
    <input
      type="text"
      name="{name}_ka"
      value={ka}
      required={requiredKa}
      {placeholder}
      bind:this={kaEl}
    />
  </label>
  <label class="tri-cell">
    <span class="lang-tag lang-tag-auto">EN</span>
    <input
      type="text"
      name="{name}_en"
      value={en}
      placeholder="ავტომატური თარგმანი"
      bind:this={enEl}
    />
  </label>
  <label class="tri-cell">
    <span class="lang-tag lang-tag-auto">РУ</span>
    <input
      type="text"
      name="{name}_ru"
      value={ru}
      placeholder="ავტომატური თარგმანი"
      bind:this={ruEl}
    />
  </label>
  <button
    type="button"
    class="tri-translate"
    onclick={translate}
    disabled={busy}
    title="EN/РУ ველების შევსება ქართულიდან"
  >
    {busy ? 'ითარგმნება…' : '🌐 თარგმნა'}
  </button>
  {#if error}
    <span class="tri-error" role="alert">{error}</span>
  {/if}
</div>

<style>
  .tri-field {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .tri-cell {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 1 1 12rem;
    min-width: 0;
  }

  .tri-cell input {
    flex: 1;
    min-width: 0;
  }

  .lang-tag {
    flex-shrink: 0;
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--c-primary-800);
    background: var(--c-primary-100);
    border-radius: 4px;
    padding: 0.1875rem 0.375rem;
    min-width: 1.875rem;
    text-align: center;
  }

  .lang-tag-auto {
    color: var(--c-accent-600);
    background: var(--c-accent-100);
  }

  .tri-translate {
    flex-shrink: 0;
    font-family: inherit;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--c-accent-600);
    background: var(--c-accent-100);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    padding: 0.4375rem 0.75rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .tri-translate:hover:not(:disabled) {
    border-color: var(--c-accent-500);
  }

  .tri-translate:disabled {
    opacity: 0.7;
    cursor: progress;
  }

  .tri-error {
    flex-basis: 100%;
    color: var(--c-red-600);
    font-size: var(--fs-xs);
  }
</style>
