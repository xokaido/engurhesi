<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);

	const entityLabel = $derived((entity: string) => {
		switch (entity) {
			case 'article':
				return t(locale, 'navNews');
			case 'procurement':
				return t(locale, 'navProcurement');
			case 'project':
				return t(locale, 'navProjects');
			case 'page':
				return t(locale, 'navAbout');
			case 'document':
				return t(locale, 'navAbout');
			default:
				return entity;
		}
	});
</script>

<svelte:head>
	<title>{t(locale, 'search')} — {t(locale, 'siteName')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs"><a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'search')}</p>
		<h1>{t(locale, 'search')}</h1>
	</div>
</div>

<div class="container section search-wrap">
	<form method="GET" class="search-form" role="search">
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder={t(locale, 'searchPlaceholder')}
			aria-label={t(locale, 'search')}
			maxlength="200"
		/>
		<button class="btn" type="submit">{t(locale, 'search')}</button>
	</form>

	{#if data.q}
		<h2 class="results-head">{t(locale, 'searchResults')} — «{data.q}»</h2>
		{#if data.results.length > 0}
			<ul class="results">
				{#each data.results as result (result.entity + result.entityId)}
					<li>
						<span class="badge">{entityLabel(result.entity)}</span>
						<a href={result.href}>{result.title}</a>
						<!-- snippet comes from FTS with only <mark> markup -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						<p class="muted">{@html result.snippet}</p>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="empty">{t(locale, 'searchNoResults')}</p>
		{/if}
	{/if}
</div>

<style>
	.search-wrap {
		max-width: 46rem;
	}

	.search-form {
		display: flex;
		gap: var(--sp-1);
		margin-bottom: var(--sp-4);
	}

	.results-head {
		font-size: var(--fs-xl);
		margin-bottom: var(--sp-3);
	}

	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--sp-2);
	}

	.results li {
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		border-radius: var(--radius-sm);
		padding: var(--sp-2);
	}

	.results a {
		display: block;
		font-weight: 700;
		font-size: var(--fs-lg);
		margin-top: 0.375rem;
		text-decoration: none;
		color: var(--c-primary-900);
	}

	.results a:hover {
		color: var(--c-accent-600);
	}

	.results p {
		margin: 0.375rem 0 0;
		font-size: var(--fs-sm);
	}

	.results :global(mark) {
		background: var(--c-accent-100);
		color: var(--c-primary-900);
		border-radius: 2px;
	}
</style>
