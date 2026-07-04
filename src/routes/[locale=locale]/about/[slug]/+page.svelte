<script lang="ts">
	import { t, LOCALE_LABELS, type Locale } from '$lib/i18n';
	import { formatBytes, mediaFileUrl } from '$lib/types';
	import LangNotice from '$lib/components/LangNotice.svelte';
	import OrgTree from '$lib/components/OrgTree.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
	const page = $derived(data.page);

	const docsByYear = $derived.by(() => {
		if (!data.documents) return [];
		const groups = new Map<string, NonNullable<typeof data.documents>>();
		for (const doc of data.documents) {
			const year = doc.year ? String(doc.year) : '—';
			if (!groups.has(year)) groups.set(year, []);
			groups.get(year)!.push(doc);
		}
		return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
	});
</script>

<svelte:head>
	<title>{page.seoTitle ?? page.title} — {t(locale, 'siteName')}</title>
	{#if page.seoDescription}
		<meta name="description" content={page.seoDescription} />
	{/if}
</svelte:head>

<article>
	<h2 class="page-title">{page.title}</h2>
	<LangNotice {locale} fallback={page.fallback} machine={page.machine} />

	<div class="prose">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html page.bodyHtml}
	</div>

	{#if data.orgTree && data.orgTree.length > 0}
		<div class="org-tree-wrap">
			<OrgTree nodes={data.orgTree} />
		</div>
	{/if}

	{#if data.documents}
		{#each docsByYear as [year, docs] (year)}
			<h3 class="year-head">{year}</h3>
			{#each docs as doc (doc.slug)}
				<div class="doc-row doc-row-static">
					<span class="doc-icon">PDF</span>
					<span class="doc-title">
						{doc.title}
						{#if doc.description}<span class="muted doc-desc">{doc.description}</span>{/if}
					</span>
					<span class="doc-langs">
						{#each doc.files as file (file.locale + file.mediaId)}
							<a
								class="badge"
								href={mediaFileUrl(file.mediaId)}
								target="_blank"
								rel="noopener"
								title="{t(locale, 'download')} ({formatBytes(file.size)})"
							>
								{LOCALE_LABELS[file.locale as Locale] ?? file.locale}
							</a>
						{/each}
					</span>
				</div>
			{/each}
		{/each}
	{/if}
</article>

<style>
	.page-title {
		font-size: var(--fs-2xl);
		margin-bottom: var(--sp-3);
	}

	.org-tree-wrap {
		margin-top: var(--sp-4);
	}

	.year-head {
		font-size: var(--fs-xl);
		margin: var(--sp-4) 0 var(--sp-2);
		color: var(--c-ink-500);
	}

	.doc-row-static {
		cursor: default;
	}

	.doc-desc {
		display: block;
		font-size: var(--fs-xs);
		font-weight: 400;
	}

	.doc-langs {
		display: flex;
		gap: 0.375rem;
	}

	.doc-langs .badge {
		text-decoration: none;
	}

	.doc-langs .badge:hover {
		background: var(--c-primary-800);
		color: #fff;
	}
</style>
