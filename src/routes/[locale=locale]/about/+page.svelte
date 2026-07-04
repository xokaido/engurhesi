<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
</script>

<svelte:head>
	<title>{t(locale, 'aboutTitle')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={t(locale, 'siteTagline')} />
</svelte:head>

<div class="about-cards">
	{#each data.aboutPages as item (item.slug)}
		<a class="about-card" href={localePath(locale, `/about/${item.slug}`)}>
			<span>{item.title}</span>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			</svg>
		</a>
	{/each}
</div>

<style>
	.about-cards {
		display: grid;
		gap: var(--sp-2);
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}

	.about-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
		padding: var(--sp-3);
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		border-radius: var(--radius);
		text-decoration: none;
		font-weight: 700;
		color: var(--c-primary-900);
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.about-card:hover {
		border-color: var(--c-accent-500);
		box-shadow: var(--shadow-card);
		color: var(--c-accent-600);
	}
</style>
