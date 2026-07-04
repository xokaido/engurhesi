<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';
	import ProcurementRow from '$lib/components/ProcurementRow.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);

	function href(kind: string | null, open: boolean | null): string {
		const params = new URLSearchParams();
		if (kind) params.set('kind', kind);
		if (open !== null) params.set('status', open ? 'open' : 'closed');
		const qs = params.toString();
		return localePath(locale, `/procurement${qs ? `?${qs}` : ''}`);
	}

	/** closed items grouped by year for the archive */
	const closedByYear = $derived.by(() => {
		if (data.open !== false) return [];
		const groups = new Map<string, typeof data.items>();
		for (const item of data.items) {
			const year = (item.publishedAt ?? '').slice(0, 4) || '—';
			if (!groups.has(year)) groups.set(year, []);
			groups.get(year)!.push(item);
		}
		return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
	});
</script>

<svelte:head>
	<title>{t(locale, 'navProcurement')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={t(locale, 'activeProcurement')} />
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs"><a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'navProcurement')}</p>
		<h1>{t(locale, 'navProcurement')}</h1>
	</div>
</div>

<div class="container section">
	<ul class="pills" aria-label="Kind">
		<li><a class="pill" href={href(null, data.open)} aria-current={data.kind === null ? 'true' : undefined}>{t(locale, 'categoryAll')}</a></li>
		<li><a class="pill" href={href('tender', data.open)} aria-current={data.kind === 'tender' ? 'true' : undefined}>{t(locale, 'tenders')}</a></li>
		<li><a class="pill" href={href('auction', data.open)} aria-current={data.kind === 'auction' ? 'true' : undefined}>{t(locale, 'auctions')}</a></li>
	</ul>
	<ul class="pills" aria-label="Status">
		<li><a class="pill" href={href(data.kind, null)} aria-current={data.open === null ? 'true' : undefined}>{t(locale, 'categoryAll')}</a></li>
		<li><a class="pill" href={href(data.kind, true)} aria-current={data.open === true ? 'true' : undefined}>{t(locale, 'statusOpen')}</a></li>
		<li><a class="pill" href={href(data.kind, false)} aria-current={data.open === false ? 'true' : undefined}>{t(locale, 'statusClosed')}</a></li>
	</ul>

	{#if data.items.length === 0}
		<p class="empty">{t(locale, 'emptyList')}</p>
	{:else if data.open === false}
		{#each closedByYear as [year, items] (year)}
			<h2 class="year-head">{year}</h2>
			{#each items as item (item.slug)}
				<ProcurementRow {locale} {item} />
			{/each}
		{/each}
	{:else}
		{#each data.items as item (item.slug)}
			<ProcurementRow {locale} {item} />
		{/each}
	{/if}
</div>

<style>
	.year-head {
		font-size: var(--fs-xl);
		margin: var(--sp-4) 0 var(--sp-2);
		color: var(--c-ink-500);
	}
</style>
