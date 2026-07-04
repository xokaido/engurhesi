<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';

	let { data, form } = $props();
	const locale = $derived(data.locale as Locale);
</script>

<svelte:head>
	<title>{t(locale, 'contactTitle')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={t(locale, 'writeToUs')} />
	{#if data.turnstileSiteKey}
		<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
	{/if}
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs"><a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'contactTitle')}</p>
		<h1>{t(locale, 'contactTitle')}</h1>
	</div>
</div>

<div class="container section contact-grid">
	<div class="contact-info">
		{#if data.contact.address}
			<div class="info-block">
				<h2>{t(locale, 'address')}</h2>
				<p>{data.contact.address}</p>
				{#if data.contact.mapUrl}
					<a class="btn btn-outline btn-sm" href={data.contact.mapUrl} target="_blank" rel="noopener noreferrer">
						{t(locale, 'openInMaps')}
					</a>
				{/if}
			</div>
		{/if}
		{#if data.contact.phone}
			<div class="info-block">
				<h2>{t(locale, 'phone')}</h2>
				<p><a href="tel:{data.contact.phone.replace(/\s/g, '')}">{data.contact.phone}</a></p>
			</div>
		{/if}
		{#if data.contact.email}
			<div class="info-block">
				<h2>{t(locale, 'formEmail')}</h2>
				<p><a href="mailto:{data.contact.email}">{data.contact.email}</a></p>
			</div>
		{/if}
	</div>

	<div class="contact-form">
		<h2>{t(locale, 'writeToUs')}</h2>

		{#if form?.success}
			<p class="notice form-ok" role="status">{t(locale, 'formSuccess')}</p>
		{:else}
			{#if form?.error}
				<p class="notice notice-amber" role="alert">{t(locale, 'formError')}</p>
			{/if}
			<form method="POST">
				<label class="field">
					<span>{t(locale, 'formName')}</span>
					<input name="name" type="text" required maxlength="200" value={form?.name ?? ''} autocomplete="name" />
				</label>
				<label class="field">
					<span>{t(locale, 'formEmail')}</span>
					<input name="email" type="email" required maxlength="200" value={form?.email ?? ''} autocomplete="email" />
				</label>
				<label class="field">
					<span>{t(locale, 'formSubject')}</span>
					<input name="subject" type="text" required maxlength="300" value={form?.subject ?? ''} />
				</label>
				<label class="field">
					<span>{t(locale, 'formMessage')}</span>
					<textarea name="message" required maxlength="10000">{form?.message ?? ''}</textarea>
				</label>
				<!-- honeypot -->
				<input class="visually-hidden" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
				{#if data.turnstileSiteKey}
					<div class="cf-turnstile" data-sitekey={data.turnstileSiteKey}></div>
				{/if}
				<button class="btn" type="submit">{t(locale, 'formSend')}</button>
			</form>
		{/if}
	</div>
</div>

<style>
	.contact-grid {
		display: grid;
		grid-template-columns: 1fr 1.4fr;
		gap: var(--sp-8);
		align-items: start;
	}

	@media (max-width: 1023px) {
		.contact-grid {
			grid-template-columns: 1fr;
			gap: var(--sp-4);
		}
	}

	.info-block {
		margin-bottom: var(--sp-4);
	}

	.info-block h2 {
		font-size: var(--fs-base);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-ink-500);
		margin-bottom: 0.375rem;
	}

	.info-block p {
		margin: 0 0 0.75rem;
		font-size: var(--fs-lg);
		font-weight: 600;
		color: var(--c-primary-900);
	}

	.contact-form {
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		border-radius: var(--radius);
		padding: var(--sp-4);
	}

	.contact-form h2 {
		margin-bottom: var(--sp-3);
	}

	.form-ok {
		background: var(--c-green-100);
		border-color: #bbf7d0;
		color: var(--c-green-600);
	}
</style>
