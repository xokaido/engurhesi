<script lang="ts">
  import { localePath, t, type Locale } from '$lib/i18n';
  import { mediaImgUrl } from '$lib/types';
  import NewsCard from '$lib/components/NewsCard.svelte';
  import ProcurementRow from '$lib/components/ProcurementRow.svelte';
  import MediaImage from '$lib/components/MediaImage.svelte';

  let { data } = $props();
  const locale = $derived(data.locale as Locale);
</script>

<svelte:head>
  <title>{t(locale, 'siteName')} — {t(locale, 'siteTagline')}</title>
  <meta name="description" content={t(locale, 'siteTagline')} />
  <meta property="og:title" content={t(locale, 'siteName')} />
  <meta property="og:description" content={t(locale, 'siteTagline')} />
  {#if data.hero}
    <meta property="og:image" content={mediaImgUrl(data.hero.id, 'hero')} />
  {/if}
</svelte:head>

<!-- Hero -->
<section
  class="hero"
  style:--hero-image={data.hero
    ? `url(${mediaImgUrl(data.hero.id, 'hero')})`
    : `url('/img/hero-dam.jpg')`}
>
  <div class="container hero-inner">
    <p class="hero-kicker">{t(locale, 'operatingSince')} 1978</p>
    <h1>{t(locale, 'siteName')}</h1>
    <p class="hero-sub">{t(locale, 'siteTagline')}</p>
    <div class="hero-ctas">
      <a class="btn btn-hero" href={localePath(locale, '/about')}>{t(locale, 'heroCtaAbout')}</a>
      <a class="btn btn-ghost-light" href={localePath(locale, '/procurement')}>
        {t(locale, 'heroCtaProcurement')}
      </a>
    </div>
  </div>
</section>

<!-- Stats band -->
{#if data.stats.length > 0}
  <section class="stats-wrap" aria-label="Key figures">
    <div class="container">
      <div class="stats-card">
        {#each data.stats as stat (stat.key)}
          <div class="stat">
            <span class="stat-value">{stat.value}<small>{stat.unit ?? ''}</small></span>
            <span class="stat-label">{stat.label}</span>
          </div>
        {/each}
      </div>
    </div>
  </section>
{/if}

<!-- Latest news -->
<section class="section">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="section-kicker">{t(locale, 'navNews')}</p>
        <h2>{t(locale, 'latestNews')}</h2>
      </div>
      <a class="section-link" href={localePath(locale, '/news')}>{t(locale, 'allNews')}</a>
    </div>
    {#if data.news.length > 0}
      <div class="card-grid">
        {#each data.news as item (item.slug)}
          <NewsCard
            {locale}
            slug={item.slug}
            title={item.title}
            excerpt={item.excerpt}
            category={item.category}
            publishedAt={item.publishedAt}
            cover={item.cover}
          />
        {/each}
      </div>
    {:else}
      <p class="empty">{t(locale, 'emptyList')}</p>
    {/if}
  </div>
</section>

<!-- About teaser -->
<section class="about-band">
  <div class="container about-band-grid">
    <div class="about-band-media">
      <img src="/img/activity.jpg" alt="" loading="lazy" decoding="async" />
    </div>
    <div class="about-band-text">
      <p class="section-kicker">{t(locale, 'aboutTeaserKicker')}</p>
      <h2>{t(locale, 'aboutTeaserTitle')}</h2>
      <p>{t(locale, 'aboutTeaserBody')}</p>
      <a class="btn" href={localePath(locale, '/about')}>{t(locale, 'learnMore')}</a>
    </div>
  </div>
</section>

<!-- Active procurement -->
<section class="section proc-section">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="section-kicker">{t(locale, 'navProcurement')}</p>
        <h2>{t(locale, 'activeProcurement')}</h2>
      </div>
      <a class="section-link" href={localePath(locale, '/procurement')}>
        {t(locale, 'allProcurement')}
      </a>
    </div>
    {#if data.procurement.length > 0}
      {#each data.procurement as item (item.slug)}
        <ProcurementRow {locale} {item} />
      {/each}
    {:else}
      <p class="empty">{t(locale, 'emptyList')}</p>
    {/if}
  </div>
</section>

<!-- Projects strip -->
{#if data.projects.length > 0}
  <section class="section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="section-kicker">{t(locale, 'navProjects')}</p>
          <h2>{t(locale, 'ourProjects')}</h2>
        </div>
        <a class="section-link" href={localePath(locale, '/projects')}>
          {t(locale, 'allProjects')}
        </a>
      </div>
      <div class="project-grid">
        {#each data.projects as project (project.slug)}
          <a class="project-card" href={localePath(locale, `/projects/${project.slug}`)}>
            <div class="project-media">
              {#if project.cover}
                <MediaImage media={project.cover} preset="card" />
              {:else}
                <img src="/img/operation.jpg" alt="" loading="lazy" decoding="async" />
              {/if}
            </div>
            <div class="project-overlay">
              <h3>{project.title}</h3>
              {#if project.summary}
                <p>{project.summary}</p>
              {/if}
              <span class="project-more">{t(locale, 'readMore')} →</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  </section>
{/if}

<!-- Partners -->
{#if data.partners.length > 0}
  <section class="section partners-section">
    <div class="container">
      <div class="section-head">
        <div>
          <p class="section-kicker">{t(locale, 'siteName')}</p>
          <h2>{t(locale, 'partners')}</h2>
        </div>
      </div>
      <ul class="partner-strip">
        {#each data.partners as partner (partner.name)}
          <li>
            {#if partner.url}
              <a href={partner.url} rel="noopener noreferrer" target="_blank" title={partner.name}>
                {#if partner.logo}
                  <MediaImage media={partner.logo} preset="thumb" alt={partner.name} />
                {:else}
                  <span class="partner-name">{partner.name}</span>
                {/if}
              </a>
            {:else if partner.logo}
              <MediaImage media={partner.logo} preset="thumb" alt={partner.name} />
            {:else}
              <span class="partner-name">{partner.name}</span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </section>
{/if}

<style>
  .hero {
    position: relative;
    color: #fff;
    padding-block: clamp(5rem, 14vw, 11rem) clamp(7rem, 15vw, 12rem);
    background:
      linear-gradient(
        100deg,
        rgb(7 42 66 / 0.9) 0%,
        rgb(7 42 66 / 0.62) 48%,
        rgb(7 42 66 / 0.18) 100%
      ),
      var(--hero-image), linear-gradient(160deg, var(--c-primary-900), #0d4a70);
    background-size: cover;
    background-position: center;
    overflow: hidden;
  }

  .hero-inner {
    max-width: 46rem;
    margin-inline: 0 auto;
  }

  .hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: var(--fs-xs);
    color: #67e8f9;
    margin: 0 0 var(--sp-2);
    font-weight: 800;
    padding: 0.375rem 0.875rem;
    border: 1px solid rgb(103 232 249 / 0.35);
    border-radius: 999px;
    background: rgb(7 42 66 / 0.35);
    backdrop-filter: blur(4px);
  }

  .hero h1 {
    color: #fff;
    font-size: var(--fs-hero);
    margin-bottom: var(--sp-2);
    text-shadow: 0 2px 24px rgb(7 42 66 / 0.55);
  }

  .hero-sub {
    font-size: var(--fs-lg);
    color: rgb(255 255 255 / 0.92);
    margin: 0 0 var(--sp-4);
    max-width: 34rem;
    text-shadow: 0 1px 12px rgb(7 42 66 / 0.6);
  }

  .hero-ctas {
    display: flex;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }

  .btn-hero {
    background: var(--c-accent-500);
    box-shadow: 0 8px 24px -8px rgb(8 145 178 / 0.7);
  }

  .btn-hero:hover {
    background: var(--c-accent-600);
  }

  /* stats — floating card overlapping the hero */
  .stats-wrap {
    margin-top: clamp(-5.5rem, -8vw, -4rem);
    position: relative;
    z-index: 2;
  }

  .stats-card {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-3);
    background: var(--c-surface);
    border: 1px solid var(--c-line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lift);
    padding: var(--sp-4);
  }

  @media (max-width: 1023px) {
    .stats-card {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 479px) {
    .stats-card {
      grid-template-columns: 1fr;
    }
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding-left: var(--sp-2);
    border-left: 3px solid var(--c-accent-500);
  }

  .stat-value {
    font-size: var(--fs-stat);
    font-weight: 800;
    color: var(--c-primary-800);
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .stat-value small {
    font-size: 0.42em;
    font-weight: 700;
    color: var(--c-accent-600);
    margin-left: 0.3rem;
  }

  .stat-label {
    color: var(--c-ink-500);
    font-size: var(--fs-sm);
  }

  /* about teaser band */
  .about-band {
    background:
      radial-gradient(130% 170% at 0% 100%, rgb(8 145 178 / 0.16) 0%, transparent 55%),
      var(--c-primary-900);
    color: #fff;
    padding-block: var(--sp-8);
  }

  .about-band-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: var(--sp-6);
    align-items: center;
  }

  @media (max-width: 1023px) {
    .about-band-grid {
      grid-template-columns: 1fr;
    }
  }

  .about-band-media {
    position: relative;
  }

  .about-band-media::before {
    content: '';
    position: absolute;
    inset: 1.25rem -1.25rem -1.25rem 1.25rem;
    border: 2px solid rgb(103 232 249 / 0.35);
    border-radius: var(--radius-lg);
    pointer-events: none;
  }

  .about-band-media img {
    width: 100%;
    aspect-ratio: 3 / 2;
    object-fit: cover;
    border-radius: var(--radius-lg);
    box-shadow: 0 24px 48px -20px rgb(0 0 0 / 0.55);
  }

  .about-band-text h2 {
    color: #fff;
    font-size: var(--fs-2xl);
  }

  .about-band-text p {
    color: rgb(255 255 255 / 0.82);
    margin: 0 0 var(--sp-3);
    max-width: 34rem;
  }

  .about-band-text .section-kicker {
    color: #67e8f9;
  }

  .about-band-text .btn {
    background: var(--c-accent-500);
  }

  .about-band-text .btn:hover {
    background: var(--c-accent-600);
  }

  .proc-section {
    background: var(--c-warm-100);
  }

  /* projects — photo cards with overlay */
  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(22rem, 100%), 1fr));
    gap: var(--sp-3);
  }

  .project-card {
    position: relative;
    display: block;
    border-radius: var(--radius-lg);
    overflow: hidden;
    text-decoration: none;
    min-height: 22rem;
    box-shadow: var(--shadow-card);
    isolation: isolate;
  }

  .project-media {
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(145deg, var(--c-primary-800), var(--c-accent-600));
  }

  .project-media :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }

  .project-card:hover .project-media :global(img) {
    transform: scale(1.05);
  }

  .project-overlay {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 0.5rem;
    height: 100%;
    min-height: 22rem;
    padding: var(--sp-3);
    background: linear-gradient(
      180deg,
      rgb(7 42 66 / 0) 30%,
      rgb(7 42 66 / 0.55) 60%,
      rgb(7 42 66 / 0.92) 100%
    );
  }

  .project-overlay h3 {
    color: #fff;
    margin: 0;
    font-size: var(--fs-xl);
  }

  .project-overlay p {
    color: rgb(255 255 255 / 0.85);
    margin: 0;
    font-size: var(--fs-sm);
    max-width: 30rem;
  }

  .project-more {
    color: #67e8f9;
    font-weight: 700;
    font-size: var(--fs-sm);
    margin-top: 0.25rem;
  }

  /* partners */
  .partners-section {
    border-top: 1px solid var(--c-line);
  }

  .partner-strip {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--sp-2);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .partner-strip li {
    background: var(--c-surface);
    border: 1px solid var(--c-line);
    border-radius: var(--radius);
    min-height: 6.5rem;
    display: grid;
    place-items: center;
    padding: var(--sp-2);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .partner-strip li:hover {
    border-color: var(--c-accent-500);
    box-shadow: var(--shadow-card);
  }

  .partner-strip li a {
    display: grid;
    place-items: center;
    text-decoration: none;
  }

  .partner-strip li :global(img) {
    max-height: 3.5rem;
    width: auto;
    max-width: 100%;
    object-fit: contain;
    background: transparent !important;
    filter: grayscale(1);
    opacity: 0.8;
    transition:
      filter 0.2s ease,
      opacity 0.2s ease;
  }

  .partner-strip li:hover :global(img) {
    filter: none;
    opacity: 1;
  }

  .partner-name {
    font-weight: 700;
    color: var(--c-ink-500);
    font-size: var(--fs-sm);
    text-align: center;
  }
</style>
