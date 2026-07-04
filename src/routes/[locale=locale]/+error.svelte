<script lang="ts">
	import { page } from '$app/state';
	import { isLocale, localePath, t, type Locale } from '$lib/i18n';

	const locale = $derived.by((): Locale => {
		const first = page.url.pathname.split('/').filter(Boolean)[0] ?? 'ka';
		return isLocale(first) ? first : 'ka';
	});
</script>

<svelte:head>
	<title>{page.status} — {t(locale, 'siteName')}</title>
</svelte:head>

<div class="container section error-wrap">
	<p class="error-code">{page.status}</p>
	<h1>{page.status === 404 ? t(locale, 'notFoundTitle') : 'Error'}</h1>
	<p class="muted">{page.status === 404 ? t(locale, 'notFoundBody') : (page.error?.message ?? '')}</p>
	<a class="btn" href={localePath(locale, '/')}>{t(locale, 'backHome')}</a>
</div>

<style>
	.error-wrap {
		text-align: center;
		padding-block: var(--sp-12);
	}

	.error-code {
		font-size: clamp(4rem, 12vw, 7rem);
		font-weight: 800;
		color: var(--c-primary-100);
		line-height: 1;
		margin: 0;
	}

	.error-wrap h1 {
		margin-bottom: var(--sp-2);
	}

	.error-wrap .btn {
		margin-top: var(--sp-3);
	}
</style>
