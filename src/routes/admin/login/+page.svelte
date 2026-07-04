<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>ავტორიზაცია — engurhesi.ge</title>
  <meta name="robots" content="noindex" />
  {#if data.turnstileSiteKey}
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  {/if}
</svelte:head>

<main class="login-wrap">
  <div class="login-card">
    <div class="login-brand">
      <svg viewBox="0 0 40 40" width="46" height="46" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#0891b2" />
            <stop offset="1" stop-color="#072a42" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="9" fill="url(#lg)" />
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
      <div class="login-brand-text">
        <strong>ენგურჰესი</strong>
        <span>ადმინისტრირების პანელი</span>
      </div>
    </div>

    {#if form?.error}
      <p class="login-error" role="alert">{form.error}</p>
    {/if}

    <h1>ავტორიზაცია</h1>
    <form method="POST" action="?/login">
      <label class="field">
        <span>ელფოსტა</span>
        <input name="email" type="email" required autocomplete="username" />
      </label>
      <label class="field">
        <span>პაროლი</span>
        <input name="password" type="password" required autocomplete="current-password" />
      </label>
      {#if data.turnstileSiteKey}
        <div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
      {/if}
      <button class="btn login-btn" type="submit">შესვლა</button>
    </form>

    <p class="back"><a href="/ka">← engurhesi.ge</a></p>
  </div>
</main>

<style>
  .login-wrap {
    min-height: 100vh;
    display: grid;
    place-items: center;
    background:
      linear-gradient(
        120deg,
        rgb(7 42 66 / 0.94) 0%,
        rgb(11 60 93 / 0.86) 60%,
        rgb(8 145 178 / 0.55) 100%
      ),
      url('/img/hero-dam.jpg') center / cover no-repeat,
      linear-gradient(160deg, var(--c-primary-900), var(--c-primary-800));
    padding: var(--sp-3);
  }

  .login-card {
    width: 100%;
    max-width: 26rem;
    background: var(--c-surface);
    border-radius: var(--radius-lg);
    padding: var(--sp-4);
    box-shadow: 0 32px 80px -24px rgb(0 0 0 / 0.6);
  }

  .login-brand {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    margin-bottom: var(--sp-3);
  }

  .login-brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }

  .login-brand strong {
    font-size: 1.25rem;
    color: var(--c-primary-800);
  }

  .login-brand span {
    color: var(--c-ink-500);
    font-size: var(--fs-sm);
  }

  h1 {
    font-size: var(--fs-xl);
  }

  .login-error {
    background: var(--c-red-100);
    color: var(--c-red-600);
    padding: 0.625rem 1rem;
    border-radius: var(--radius-sm);
    font-size: var(--fs-sm);
  }

  .login-btn {
    width: 100%;
    margin-top: var(--sp-1);
  }

  .back {
    margin-top: var(--sp-3);
    text-align: center;
    font-size: var(--fs-sm);
  }
</style>
