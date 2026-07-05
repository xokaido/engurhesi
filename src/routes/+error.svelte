<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status} — engurhesi.ge</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="err-page">
  <div class="err-card">
    <svg viewBox="0 0 40 40" width="52" height="52" aria-hidden="true">
      <defs>
        <linearGradient id="re" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0891b2" />
          <stop offset="1" stop-color="#072a42" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#re)" />
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
    <p class="err-status">{page.status}</p>
    <h1>
      {page.status === 404
        ? 'გვერდი ვერ მოიძებნა · Page not found'
        : 'დაფიქსირდა შეცდომა · Something went wrong'}
    </h1>
    {#if page.status !== 404 && page.error?.message}
      <p class="err-detail">{page.error.message}</p>
    {/if}
    <a class="err-btn" href="/ka">engurhesi.ge</a>
  </div>
</main>

<style>
  .err-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: var(--sp-3);
    background:
      radial-gradient(120% 160% at 100% 0%, rgb(8 145 178 / 0.35) 0%, transparent 55%),
      linear-gradient(160deg, var(--c-primary-900) 0%, var(--c-primary-800) 65%, #0d4a70 100%);
  }

  .err-card {
    width: 100%;
    max-width: 30rem;
    background: var(--c-surface);
    border-radius: var(--radius-lg);
    padding: var(--sp-6) var(--sp-4);
    text-align: center;
    box-shadow: 0 32px 80px -24px rgb(0 0 0 / 0.6);
  }

  .err-status {
    font-size: 4.5rem;
    font-weight: 800;
    line-height: 1;
    margin: var(--sp-2) 0 0.5rem;
    color: var(--c-primary-800);
    letter-spacing: -0.02em;
  }

  .err-card h1 {
    font-size: var(--fs-lg);
    margin-bottom: var(--sp-1);
  }

  .err-detail {
    color: var(--c-ink-500);
    font-size: var(--fs-xs);
    word-break: break-word;
    margin: 0;
  }

  .err-btn {
    display: inline-block;
    margin-top: var(--sp-3);
    padding: 0.75rem 1.75rem;
    background: var(--c-primary-800);
    color: #fff;
    text-decoration: none;
    font-weight: 600;
    border-radius: var(--radius-sm);
  }

  .err-btn:hover {
    background: var(--c-primary-700);
    color: #fff;
  }
</style>
