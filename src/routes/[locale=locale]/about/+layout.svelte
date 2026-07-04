<script lang="ts">
  import { page } from '$app/state';
  import { localePath, t, type Locale } from '$lib/i18n';

  let { data, children } = $props();
  const locale = $derived(data.locale as Locale);

  function isActive(slug: string): boolean {
    return page.url.pathname.endsWith(`/about/${slug}`);
  }

  /** on the section index the child page already lists the sub-pages */
  const isIndex = $derived(/\/about\/?$/.test(page.url.pathname));
</script>

<div class="page-hero">
  <div class="container">
    <p class="crumbs">
      <a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'aboutTitle')}
    </p>
    <h1>{t(locale, 'aboutTitle')}</h1>
  </div>
</div>

<div class="container section about-grid" class:about-grid-full={isIndex}>
  {#if !isIndex}
    <nav class="about-nav" aria-label={t(locale, 'aboutTitle')}>
      <ul>
        {#each data.aboutPages as item (item.slug)}
          <li>
            <a
              href={localePath(locale, `/about/${item.slug}`)}
              aria-current={isActive(item.slug) ? 'page' : undefined}
            >
              {item.title}
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  {/if}

  <div class="about-content">
    {@render children()}
  </div>
</div>

<style>
  .about-grid {
    display: grid;
    grid-template-columns: 16rem minmax(0, 1fr);
    gap: var(--sp-6);
    align-items: start;
  }

  .about-grid-full {
    grid-template-columns: minmax(0, 1fr);
  }

  .about-nav {
    position: sticky;
    top: 5.5rem;
  }

  .about-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
    background: var(--c-surface);
    border: 1px solid var(--c-line);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .about-nav a {
    display: block;
    padding: 0.75rem 1rem;
    text-decoration: none;
    color: var(--c-ink-700);
    font-weight: 600;
    font-size: var(--fs-sm);
    border-left: 3px solid transparent;
  }

  .about-nav a:hover {
    background: var(--c-primary-50);
    color: var(--c-primary-800);
  }

  .about-nav a[aria-current='page'] {
    border-left-color: var(--c-accent-500);
    background: var(--c-primary-50);
    color: var(--c-primary-900);
  }

  @media (max-width: 1023px) {
    .about-grid {
      grid-template-columns: 1fr;
      gap: var(--sp-3);
    }

    .about-nav {
      position: static;
      overflow-x: auto;
    }

    .about-nav ul {
      display: flex;
      border-radius: 999px;
      white-space: nowrap;
    }

    .about-nav a {
      border-left: none;
      border-bottom: 3px solid transparent;
    }

    .about-nav a[aria-current='page'] {
      border-bottom-color: var(--c-accent-500);
    }
  }
</style>
