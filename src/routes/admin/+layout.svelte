<script lang="ts">
  import { page } from '$app/state';

  let { data, children } = $props();

  // feather-style stroke icon paths, keyed by nav href
  const icons: Record<string, string[]> = {
    '/admin': ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
    '/admin/news': [
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      'M14 2v6h6',
      'M16 13H8',
      'M16 17H8'
    ],
    '/admin/procurement': [
      'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z',
      'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16'
    ],
    '/admin/pages': [
      'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z',
      'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'
    ],
    '/admin/projects': ['M12 2 2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
    '/admin/documents': [
      'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'
    ],
    '/admin/media': [
      'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
      'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
      'M21 15l-5-5L5 21'
    ],
    '/admin/gallery': [
      'M19.82 2H4.18A2.18 2.18 0 0 0 2 4.18v15.64C2 21.02 2.98 22 4.18 22h15.64A2.18 2.18 0 0 0 22 19.82V4.18A2.18 2.18 0 0 0 19.82 2z',
      'M7 2v20',
      'M17 2v20',
      'M2 12h20'
    ],
    '/admin/partners': [
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M23 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75'
    ],
    '/admin/org': [
      'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M8.59 13.51l6.83 3.98',
      'M15.41 6.51l-6.82 3.98'
    ],
    '/admin/stats': ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
    '/admin/glossary': [
      'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
      'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'
    ],
    '/admin/inbox': [
      'M22 12h-6l-2 3h-4l-2-3H2',
      'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z'
    ],
    '/admin/jobs': ['M22 12h-4l-3 9L9 3l-3 9H2'],
    '/admin/settings': [
      'M4 21v-7',
      'M4 10V3',
      'M12 21v-9',
      'M12 8V3',
      'M20 21v-5',
      'M20 12V3',
      'M1 14h6',
      'M9 8h6',
      'M17 16h6'
    ],
    '/admin/audit': ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
    '/admin/users': [
      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
      'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
    ],
    '/admin/account': [
      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
      'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
    ]
  };

  type Item = { href: string; label: string; exact?: boolean; adminOnly?: boolean };
  const groups: { title: string | null; items: Item[] }[] = [
    {
      title: null,
      items: [{ href: '/admin', label: 'დაფა', exact: true }]
    },
    {
      title: 'კონტენტი',
      items: [
        { href: '/admin/news', label: 'სიახლეები' },
        { href: '/admin/procurement', label: 'შესყიდვები' },
        { href: '/admin/pages', label: 'გვერდები' },
        { href: '/admin/projects', label: 'პროექტები' },
        { href: '/admin/documents', label: 'დოკუმენტები' }
      ]
    },
    {
      title: 'მედია',
      items: [
        { href: '/admin/media', label: 'მედია-ბიბლიოთეკა' },
        { href: '/admin/gallery', label: 'გალერეა და ვიდეო' }
      ]
    },
    {
      title: 'საიტი',
      items: [
        { href: '/admin/partners', label: 'პარტნიორები' },
        { href: '/admin/org', label: 'სტრუქტურა' },
        { href: '/admin/stats', label: 'მაჩვენებლები' },
        { href: '/admin/glossary', label: 'ტერმინოლოგია' },
        { href: '/admin/settings', label: 'პარამეტრები' }
      ]
    },
    {
      title: 'სისტემა',
      items: [
        { href: '/admin/inbox', label: 'შეტყობინებები' },
        { href: '/admin/jobs', label: 'პროცესები' },
        { href: '/admin/audit', label: 'აუდიტი', adminOnly: true },
        { href: '/admin/users', label: 'მომხმარებლები', adminOnly: true }
      ]
    }
  ];

  function isActive(href: string, exact?: boolean): boolean {
    return exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
  }

  const roleLabel = $derived(
    data.session?.role === 'admin'
      ? 'ადმინისტრატორი'
      : data.session?.role === 'editor'
        ? 'რედაქტორი'
        : 'ავტორი'
  );

  const initial = $derived((data.session?.name ?? '?').trim().charAt(0).toUpperCase());
</script>

{#snippet icon(href: string)}
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#each icons[href] ?? icons['/admin'] as d (d)}
      <path {d} />
    {/each}
  </svg>
{/snippet}

{#if !data.session}
  {@render children()}
{:else}
  <div class="admin-shell">
    <aside class="admin-side">
      <a class="admin-brand" href="/admin">
        <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
          <rect width="40" height="40" rx="9" fill="rgb(103 232 249 / 0.12)" />
          <path
            d="M7 29 Q 20 7 33 29"
            fill="none"
            stroke="#67e8f9"
            stroke-width="3.25"
            stroke-linecap="round"
          />
          <path d="M6 33.5 h28" stroke="#0891b2" stroke-width="2.5" stroke-linecap="round" />
        </svg>
        <span class="admin-brand-text">
          <strong>ენგურჰესი</strong>
          <span>ადმინი</span>
        </span>
      </a>
      <nav aria-label="Admin">
        {#each groups as group (group.title ?? 'root')}
          {@const visible = group.items.filter(
            (i) => !i.adminOnly || data.session?.role === 'admin'
          )}
          {#if visible.length > 0}
            {#if group.title}
              <p class="nav-group-title">{group.title}</p>
            {/if}
            <ul>
              {#each visible as item (item.href)}
                <li>
                  <a
                    href={item.href}
                    aria-current={isActive(item.href, item.exact) ? 'page' : undefined}
                  >
                    {@render icon(item.href)}
                    {item.label}
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        {/each}
      </nav>
      <a
        class="side-account"
        href="/admin/account"
        aria-current={isActive('/admin/account') ? 'page' : undefined}
      >
        {@render icon('/admin/account')}
        ჩემი ანგარიში
      </a>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <a class="view-site" href="/ka" target="_blank" rel="noopener">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
          </svg>
          საიტის ნახვა
        </a>
        <div class="topbar-user">
          <span class="avatar" aria-hidden="true">{initial}</span>
          <span class="topbar-user-text">
            <span class="topbar-user-name">{data.session.name}</span>
            <span class="topbar-user-role">{roleLabel}</span>
          </span>
          <form method="POST" action="/admin/logout">
            <button class="logout-btn" type="submit">გასვლა</button>
          </form>
        </div>
      </header>
      <div class="admin-content">
        {@render children()}
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-shell {
    display: grid;
    grid-template-columns: 16rem minmax(0, 1fr);
    min-height: 100vh;
    background: var(--c-warm-50);
  }

  @media (max-width: 1023px) {
    .admin-shell {
      grid-template-columns: 1fr;
    }

    .admin-side {
      position: static !important;
      height: auto !important;
    }
  }

  .admin-side {
    background: linear-gradient(180deg, var(--c-primary-900) 0%, #06263c 100%);
    color: #fff;
    padding: var(--sp-2) 0;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    scrollbar-width: thin;
  }

  .admin-brand {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.375rem var(--sp-2) 0.75rem;
    color: #fff;
    text-decoration: none;
    border-bottom: 1px solid rgb(255 255 255 / 0.08);
  }

  .admin-brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .admin-brand-text strong {
    font-size: 1.0625rem;
  }

  .admin-brand-text span {
    color: #67e8f9;
    font-size: var(--fs-xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .admin-side nav {
    flex: 1;
  }

  .nav-group-title {
    margin: var(--sp-2) var(--sp-2) 0.25rem;
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgb(255 255 255 / 0.38);
  }

  .admin-side ul {
    list-style: none;
    margin: 0;
    padding: 0 0.5rem;
  }

  .admin-side nav a {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.4375rem 0.75rem;
    color: rgb(255 255 255 / 0.75);
    text-decoration: none;
    font-size: var(--fs-sm);
    border-radius: var(--radius-sm);
    margin-bottom: 1px;
  }

  .admin-side nav a :global(svg) {
    flex-shrink: 0;
    opacity: 0.75;
  }

  .admin-side nav a:hover {
    background: rgb(255 255 255 / 0.08);
    color: #fff;
  }

  .admin-side nav a[aria-current='page'] {
    background: rgb(103 232 249 / 0.14);
    color: #67e8f9;
    font-weight: 600;
  }

  .admin-side nav a[aria-current='page'] :global(svg) {
    opacity: 1;
  }

  .side-account {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    margin: 0 0.5rem;
    padding: 0.5rem 0.75rem;
    color: rgb(255 255 255 / 0.75);
    text-decoration: none;
    font-size: var(--fs-sm);
    border-radius: var(--radius-sm);
    border-top: 1px solid rgb(255 255 255 / 0.08);
  }

  .side-account:hover {
    color: #fff;
    background: rgb(255 255 255 / 0.08);
  }

  .side-account[aria-current='page'] {
    color: #67e8f9;
  }

  /* main column */
  .admin-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .admin-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    background: var(--c-surface);
    border-bottom: 1px solid var(--c-line);
    padding: 0.5rem var(--sp-4);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .view-site {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--fs-sm);
    font-weight: 600;
    color: var(--c-ink-700);
    text-decoration: none;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--c-line);
    border-radius: 999px;
  }

  .view-site:hover {
    color: var(--c-accent-600);
    border-color: var(--c-accent-500);
  }

  .topbar-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar {
    width: 2.125rem;
    height: 2.125rem;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--c-primary-800);
    color: #67e8f9;
    font-weight: 800;
    font-size: var(--fs-sm);
  }

  .topbar-user-text {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .topbar-user-name {
    font-weight: 700;
    font-size: var(--fs-sm);
    color: var(--c-ink-900);
  }

  .topbar-user-role {
    font-size: var(--fs-xs);
    color: var(--c-ink-500);
  }

  .logout-btn {
    font-family: inherit;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--c-ink-700);
    background: transparent;
    border: 1px solid var(--c-line);
    border-radius: var(--radius-sm);
    padding: 0.375rem 0.75rem;
    cursor: pointer;
  }

  .logout-btn:hover {
    color: var(--c-red-600);
    border-color: var(--c-red-600);
    background: var(--c-red-100);
  }

  .admin-content {
    padding: var(--sp-4);
    max-width: 90rem;
    width: 100%;
  }

  /* shared admin element styles */
  .admin-content :global(h1) {
    font-size: var(--fs-2xl);
    margin-bottom: var(--sp-3);
  }

  .admin-content :global(.admin-head) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    flex-wrap: wrap;
    margin-bottom: var(--sp-3);
  }

  .admin-content :global(.admin-head h1) {
    margin: 0;
  }

  .admin-content :global(table.admin) {
    width: 100%;
    border-collapse: collapse;
    background: var(--c-surface);
    border: 1px solid var(--c-line);
    border-radius: var(--radius);
    overflow: hidden;
    font-size: var(--fs-sm);
  }

  .admin-content :global(table.admin th),
  .admin-content :global(table.admin td) {
    text-align: left;
    padding: 0.625rem 0.875rem;
    border-bottom: 1px solid var(--c-line);
    vertical-align: middle;
  }

  .admin-content :global(table.admin th) {
    background: var(--c-primary-50);
    color: var(--c-primary-800);
    white-space: nowrap;
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .admin-content :global(table.admin tbody tr:hover) {
    background: var(--c-primary-50);
  }

  .admin-content :global(table.admin tr:last-child td) {
    border-bottom: none;
  }

  .admin-content :global(.panel) {
    background: var(--c-surface);
    border: 1px solid var(--c-line);
    border-radius: var(--radius);
    padding: var(--sp-3);
    margin-bottom: var(--sp-3);
    box-shadow: 0 1px 2px rgb(7 42 66 / 0.04);
  }

  .admin-content :global(.panel h2) {
    font-size: var(--fs-lg);
    margin-bottom: var(--sp-2);
  }

  .admin-content :global(.form-row) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    gap: var(--sp-2);
  }

  .admin-content :global(.actions-row) {
    display: flex;
    gap: 0.625rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .admin-content :global(.ok-msg) {
    background: var(--c-green-100);
    color: var(--c-green-600);
    padding: 0.625rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    margin-bottom: var(--sp-2);
  }

  .admin-content :global(.err-msg) {
    background: var(--c-red-100);
    color: var(--c-red-600);
    padding: 0.625rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
    margin-bottom: var(--sp-2);
  }
</style>
