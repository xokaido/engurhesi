<script lang="ts">
  import { page } from '$app/state';
  import { isLocale, localePath, t, type Locale } from '$lib/i18n';

  const locale = $derived.by((): Locale => {
    const first = page.url.pathname.split('/').filter(Boolean)[0] ?? 'ka';
    return isLocale(first) ? first : 'ka';
  });

  const isNotFound = $derived(page.status === 404);
</script>

<svelte:head>
  <title>{page.status} — {t(locale, 'siteName')}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="container section error-wrap">
  <svg class="error-mark" viewBox="0 0 40 40" width="72" height="72" aria-hidden="true">
    <path
      d="M7 29 Q 20 7 33 29"
      fill="none"
      stroke="var(--c-primary-100)"
      stroke-width="3.25"
      stroke-linecap="round"
    />
    <path
      d="M12.5 29 Q 20 15.5 27.5 29"
      fill="none"
      stroke="var(--c-accent-500)"
      stroke-width="2"
      stroke-linecap="round"
      opacity="0.6"
    />
    <path
      d="M6 33.5 h28"
      stroke="var(--c-primary-100)"
      stroke-width="2.25"
      stroke-linecap="round"
    />
  </svg>
  <p class="error-code">{page.status}</p>
  <h1>{isNotFound ? t(locale, 'notFoundTitle') : t(locale, 'errorTitle')}</h1>
  <p class="muted error-body">{isNotFound ? t(locale, 'notFoundBody') : t(locale, 'errorBody')}</p>
  {#if !isNotFound && page.error?.message && page.error.message !== 'Internal Error'}
    <p class="error-detail">{page.error.message}</p>
  {/if}
  <div class="error-actions">
    <a class="btn" href={localePath(locale, '/')}>{t(locale, 'backHome')}</a>
    <a class="btn btn-outline" href={localePath(locale, '/contact')}>{t(locale, 'contactTitle')}</a>
  </div>
</div>

<style>
  .error-wrap {
    text-align: center;
    padding-block: var(--sp-8) var(--sp-12);
    max-width: 36rem;
  }

  .error-mark {
    margin-inline: auto;
    display: block;
  }

  .error-code {
    font-size: clamp(4.5rem, 14vw, 8rem);
    font-weight: 800;
    line-height: 1;
    margin: 0 0 var(--sp-1);
    letter-spacing: -0.03em;
    background: linear-gradient(160deg, var(--c-primary-800), var(--c-accent-500));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .error-wrap h1 {
    margin-bottom: var(--sp-1);
  }

  .error-body {
    margin: 0 auto;
    max-width: 28rem;
  }

  .error-detail {
    color: var(--c-ink-500);
    font-size: var(--fs-xs);
    word-break: break-word;
    margin: var(--sp-1) 0 0;
  }

  .error-actions {
    display: flex;
    gap: var(--sp-2);
    justify-content: center;
    flex-wrap: wrap;
    margin-top: var(--sp-4);
  }
</style>
