<script lang="ts">
  import { formatDate, localePath, t, type Locale } from '$lib/i18n';
  import type { MediaRef } from '$lib/types';
  import MediaImage from './MediaImage.svelte';

  let {
    locale,
    slug,
    title,
    excerpt = null,
    category,
    publishedAt = null,
    cover = null
  }: {
    locale: Locale;
    slug: string;
    title: string;
    excerpt?: string | null;
    category: string;
    publishedAt?: string | null;
    cover?: MediaRef | null;
  } = $props();

  const categoryKey = $derived(
    category === 'announcement'
      ? ('categoryAnnouncement' as const)
      : category === 'publication'
        ? ('categoryPublication' as const)
        : ('categoryNews' as const)
  );

  /** deterministic photographic fallback so listings never show empty slots */
  const FALLBACKS = ['/img/hero-dam.jpg', '/img/operation.jpg', '/img/activity.jpg'];
  const fallbackSrc = $derived(
    FALLBACKS[[...slug].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % FALLBACKS.length]
  );
</script>

<article class="card">
  <div class="card-media">
    {#if cover}
      <MediaImage media={cover} preset="card" />
    {:else}
      <img src={fallbackSrc} alt="" loading="lazy" decoding="async" />
    {/if}
    <span class="badge card-badge">{t(locale, categoryKey)}</span>
  </div>
  <div class="card-body">
    <div class="card-meta">
      {#if publishedAt}
        <time datetime={publishedAt}>{formatDate(locale, publishedAt)}</time>
      {/if}
    </div>
    <h3 class="card-title">
      <a href={localePath(locale, `/news/${slug}`)}>{title}</a>
    </h3>
    {#if excerpt}
      <p class="card-excerpt">{excerpt}</p>
    {/if}
  </div>
</article>

<style>
  .card-badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    background: rgb(255 255 255 / 0.92);
    color: var(--c-primary-800);
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 6px rgb(7 42 66 / 0.25);
  }
</style>
