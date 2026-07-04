<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';
	import NewsCard from '$lib/components/NewsCard.svelte';
	import Pagination from '$lib/components/Pagination.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);

	const tabs = $derived([
		{ value: null, label: t(locale, 'categoryAll') },
		{ value: 'news', label: t(locale, 'categoryNews') },
		{ value: 'announcement', label: t(locale, 'categoryAnnouncement') },
		{ value: 'publication', label: t(locale, 'categoryPublication') }
	]);

	function tabHref(value: string | null): string {
		return localePath(locale, value ? `/news?category=${value}` : '/news');
	}

	function pageHref(page: number): string {
		const params = new URLSearchParams();
		if (data.category) params.set('category', data.category);
		if (page > 1) params.set('page', String(page));
		const qs = params.toString();
		return localePath(locale, `/news${qs ? `?${qs}` : ''}`);
	}
</script>

<svelte:head>
	<title>{t(locale, 'navNews')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={t(locale, 'latestNews')} />
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs"><a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'navNews')}</p>
		<h1>{t(locale, 'navNews')}</h1>
	</div>
</div>

<div class="container section">
	<ul class="pills">
		{#each tabs as tab (tab.value ?? 'all')}
			<li>
				<a class="pill" href={tabHref(tab.value)} aria-current={data.category === tab.value ? 'true' : undefined}>
					{tab.label}
				</a>
			</li>
		{/each}
	</ul>

	{#if data.items.length > 0}
		<div class="card-grid">
			{#each data.items as item (item.slug)}
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
		<Pagination page={data.page} pages={data.pages} makeHref={pageHref} />
	{:else}
		<p class="empty">{t(locale, 'emptyList')}</p>
	{/if}
</div>
