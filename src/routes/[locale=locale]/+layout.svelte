<script lang="ts">
  import { page } from '$app/state';
  import { LOCALES, LOCALE_LABELS, localePath, t, type Locale } from '$lib/i18n';

  let { data, children } = $props();

  const locale = $derived(data.locale as Locale);

  const nav = $derived([
    { href: localePath(locale, '/about'), label: t(locale, 'navAbout'), match: '/about' },
    { href: localePath(locale, '/news'), label: t(locale, 'navNews'), match: '/news' },
    {
      href: localePath(locale, '/procurement'),
      label: t(locale, 'navProcurement'),
      match: '/procurement'
    },
    { href: localePath(locale, '/projects'), label: t(locale, 'navProjects'), match: '/projects' },
    { href: localePath(locale, '/media'), label: t(locale, 'navMedia'), match: '/media' },
    { href: localePath(locale, '/contact'), label: t(locale, 'navContact'), match: '/contact' }
  ]);

  /** current path with the locale prefix swapped */
  function switchLocaleHref(target: Locale): string {
    const rest = page.url.pathname.replace(/^\/(ka|en|ru)/, '') || '/';
    return localePath(target, rest) + page.url.search;
  }

  function isActive(match: string): boolean {
    const rest = page.url.pathname.replace(/^\/(ka|en|ru)/, '');
    return rest.startsWith(match);
  }
</script>

<svelte:head>
  {#each LOCALES as l (l)}
    <link rel="alternate" hreflang={l} href={page.url.origin + switchLocaleHref(l)} />
  {/each}
  <link rel="alternate" hreflang="x-default" href={page.url.origin + switchLocaleHref('ka')} />
</svelte:head>

<a class="skip-link" href="#main">{t(locale, 'skipToContent')}</a>

<div class="shell">
  <header class="site-header">
    <div class="topbar">
      <div class="container topbar-inner">
        <div class="topbar-contacts">
          {#if data.contact.phone}
            <a href="tel:{data.contact.phone.replace(/\s/g, '')}">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .57 3.6 1 1 0 0 1-.25 1z"
                />
              </svg>
              {data.contact.phone}
            </a>
          {/if}
          {#if data.contact.email}
            <a href="mailto:{data.contact.email}">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"
                />
              </svg>
              {data.contact.email}
            </a>
          {/if}
        </div>
        <div class="locale-switch" role="group" aria-label="Language">
          {#each LOCALES as l (l)}
            <a
              href={switchLocaleHref(l)}
              hreflang={l}
              aria-current={l === locale ? 'true' : undefined}
              class:active={l === locale}
            >
              {LOCALE_LABELS[l]}
            </a>
          {/each}
        </div>
      </div>
    </div>

    <div class="mainbar">
      <div class="container mainbar-inner">
        <a class="brand" href={localePath(locale, '/')}>
          <svg class="brand-mark" viewBox="0 0 40 40" width="42" height="42" aria-hidden="true">
            <defs>
              <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#0891b2" />
                <stop offset="1" stop-color="#072a42" />
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx="9" fill="url(#bm)" />
            <path
              d="M7 29 Q 20 7 33 29"
              fill="none"
              stroke="#67e8f9"
              stroke-width="3.25"
              stroke-linecap="round"
            />
            <path
              d="M12.5 29 Q 20 15.5 27.5 29"
              fill="none"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              opacity="0.9"
            />
            <path
              d="M6 33.5 h28"
              stroke="#67e8f9"
              stroke-width="2.25"
              stroke-linecap="round"
              opacity="0.75"
            />
          </svg>
          <span class="brand-text">
            <strong>{t(locale, 'siteName')}</strong>
            <small>engurhesi.ge</small>
          </span>
        </a>

        <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true" />
        <label for="nav-toggle" class="nav-burger" aria-label={t(locale, 'menu')}>
          <span></span><span></span><span></span>
        </label>

        <nav class="main-nav" aria-label="Main">
          <ul>
            {#each nav as item (item.match)}
              <li>
                <a href={item.href} aria-current={isActive(item.match) ? 'page' : undefined}>
                  {item.label}
                </a>
              </li>
            {/each}
          </ul>
          <a
            class="search-link"
            href={localePath(locale, '/search')}
            aria-label={t(locale, 'search')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
              <path
                d="m20 20-3.5-3.5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </a>
        </nav>
      </div>
    </div>
  </header>

  <main id="main">
    {@render children()}
  </main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <span class="footer-logo">
          <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
            <path
              d="M7 29 Q 20 7 33 29"
              fill="none"
              stroke="#67e8f9"
              stroke-width="3.25"
              stroke-linecap="round"
            />
            <path
              d="M12.5 29 Q 20 15.5 27.5 29"
              fill="none"
              stroke="#fff"
              stroke-width="2"
              stroke-linecap="round"
              opacity="0.9"
            />
            <path d="M6 33.5 h28" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <strong>{t(locale, 'siteName')}</strong>
        </span>
        <p class="muted-light">{t(locale, 'siteTagline')}</p>
      </div>
      <nav class="footer-nav" aria-label="Footer">
        <strong>{t(locale, 'quickLinks')}</strong>
        <ul>
          {#each nav as item (item.match)}
            <li><a href={item.href}>{item.label}</a></li>
          {/each}
        </ul>
      </nav>
      <div class="footer-contact">
        <strong>{t(locale, 'contactTitle')}</strong>
        {#if data.contact.address}<p>{data.contact.address}</p>{/if}
        {#if data.contact.phone}<p>
            <a href="tel:{data.contact.phone.replace(/\s/g, '')}">{data.contact.phone}</a>
          </p>{/if}
        {#if data.contact.email}<p>
            <a href="mailto:{data.contact.email}">{data.contact.email}</a>
          </p>{/if}
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container footer-bottom-inner">
        <p>© {new Date().getFullYear()} {t(locale, 'siteName')} · {t(locale, 'footerRights')}</p>
      </div>
    </div>
  </footer>
</div>

<style>
  .shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  main {
    flex: 1;
  }

  /* ------------------------------------------------------------------ */
  /* header                                                              */
  /* ------------------------------------------------------------------ */
  .site-header {
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .topbar {
    background: var(--c-primary-900);
    color: rgb(255 255 255 / 0.85);
  }

  .topbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    min-height: 2.375rem;
  }

  .topbar-contacts {
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }

  .topbar-contacts a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: rgb(255 255 255 / 0.8);
    text-decoration: none;
    font-size: var(--fs-xs);
  }

  .topbar-contacts a:hover {
    color: #67e8f9;
  }

  .locale-switch {
    display: flex;
    gap: 2px;
  }

  .locale-switch a {
    padding: 0.25rem 0.625rem;
    color: rgb(255 255 255 / 0.7);
    text-decoration: none;
    font-size: var(--fs-xs);
    font-weight: 700;
    border-radius: var(--radius-sm);
    display: inline-flex;
    align-items: center;
  }

  .locale-switch a:hover {
    color: #fff;
    background: rgb(255 255 255 / 0.1);
  }

  .locale-switch a.active {
    background: #67e8f9;
    color: var(--c-primary-900);
  }

  .mainbar {
    background: rgb(255 255 255 / 0.94);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--c-line);
    box-shadow: 0 1px 12px rgb(7 42 66 / 0.06);
  }

  .mainbar-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    min-height: 4.5rem;
    flex-wrap: wrap;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
    color: var(--c-primary-900);
    padding-block: 0.625rem;
  }

  .brand-mark {
    flex-shrink: 0;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.15;
  }

  .brand-text strong {
    font-size: 1.0625rem;
    letter-spacing: -0.01em;
  }

  .brand-text small {
    color: var(--c-accent-600);
    font-size: var(--fs-xs);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .main-nav {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .main-nav ul {
    display: flex;
    gap: 0.125rem;
    list-style: none;
    margin: 0;
    padding: 0;
    flex-wrap: wrap;
  }

  .main-nav ul a {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.25rem 0.875rem;
    color: var(--c-ink-700);
    text-decoration: none;
    font-size: var(--fs-sm);
    font-weight: 600;
    border-radius: var(--radius-sm);
  }

  .main-nav ul a:hover {
    color: var(--c-primary-900);
    background: var(--c-primary-50);
  }

  .main-nav ul a[aria-current='page'] {
    color: var(--c-accent-600);
  }

  .main-nav ul a[aria-current='page']::after {
    content: '';
    position: absolute;
    left: 0.875rem;
    right: 0.875rem;
    bottom: 4px;
    height: 2.5px;
    border-radius: 2px;
    background: var(--c-accent-500);
  }

  .search-link {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    color: var(--c-ink-700);
    border-radius: 999px;
    border: 1px solid var(--c-line);
    background: var(--c-surface);
    transition:
      border-color 0.15s ease,
      color 0.15s ease;
  }

  .search-link:hover {
    color: var(--c-accent-600);
    border-color: var(--c-accent-500);
  }

  /* burger (mobile) */
  .nav-toggle {
    display: none;
  }

  .nav-burger {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 5px;
    width: 44px;
    height: 44px;
    padding: 10px;
    cursor: pointer;
    border-radius: var(--radius-sm);
  }

  .nav-burger span {
    display: block;
    height: 2px;
    background: var(--c-primary-900);
    border-radius: 2px;
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
  }

  @media (max-width: 1023px) {
    .nav-burger {
      display: flex;
    }

    .main-nav {
      display: none;
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      padding-bottom: var(--sp-2);
      gap: var(--sp-2);
    }

    .nav-toggle:checked ~ .main-nav {
      display: flex;
    }

    .nav-toggle:checked ~ .nav-burger span:nth-child(1) {
      transform: translateY(7px) rotate(45deg);
    }

    .nav-toggle:checked ~ .nav-burger span:nth-child(2) {
      opacity: 0;
    }

    .nav-toggle:checked ~ .nav-burger span:nth-child(3) {
      transform: translateY(-7px) rotate(-45deg);
    }

    .main-nav ul {
      flex-direction: column;
    }

    .main-nav ul a {
      width: 100%;
    }

    .main-nav ul a[aria-current='page']::after {
      display: none;
    }

    .search-link {
      width: 100%;
      border-radius: var(--radius-sm);
    }
  }

  /* ------------------------------------------------------------------ */
  /* footer                                                              */
  /* ------------------------------------------------------------------ */
  .site-footer {
    background:
      radial-gradient(140% 160% at 100% 0%, rgb(8 145 178 / 0.18) 0%, transparent 50%),
      var(--c-primary-900);
    color: rgb(255 255 255 / 0.85);
    margin-top: var(--sp-8);
    border-top: 3px solid var(--c-accent-500);
  }

  .footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1.5fr;
    gap: var(--sp-6);
    padding-block: var(--sp-6);
  }

  @media (max-width: 767px) {
    .footer-grid {
      grid-template-columns: 1fr;
      gap: var(--sp-4);
    }
  }

  .footer-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: var(--sp-1);
  }

  .footer-logo strong {
    color: #fff;
    font-size: var(--fs-lg);
  }

  .footer-nav strong,
  .footer-contact strong {
    color: #fff;
    display: block;
    margin-bottom: 0.75rem;
    font-size: var(--fs-sm);
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .muted-light {
    color: rgb(255 255 255 / 0.6);
    font-size: var(--fs-sm);
    max-width: 26rem;
  }

  .footer-nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .footer-nav a,
  .footer-contact a {
    color: rgb(255 255 255 / 0.8);
    text-decoration: none;
    font-size: var(--fs-sm);
  }

  .footer-nav a:hover,
  .footer-contact a:hover {
    color: #67e8f9;
  }

  .footer-contact p {
    margin: 0 0 0.5rem;
    font-size: var(--fs-sm);
  }

  .footer-bottom {
    border-top: 1px solid rgb(255 255 255 / 0.12);
  }

  .footer-bottom-inner {
    padding-block: var(--sp-2);
  }

  .footer-bottom p {
    margin: 0;
    font-size: var(--fs-xs);
    color: rgb(255 255 255 / 0.55);
  }
</style>
