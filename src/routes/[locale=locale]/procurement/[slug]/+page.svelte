<script lang="ts">
	import { formatDate, formatDateTime, localePath, t, type Locale } from '$lib/i18n';
	import { formatBytes, mediaFileUrl } from '$lib/types';
	import DeadlineBadge from '$lib/components/DeadlineBadge.svelte';
	import LangNotice from '$lib/components/LangNotice.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
	const item = $derived(data.item);
</script>

<svelte:head>
	<title>{item.title} — {t(locale, 'navProcurement')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={item.title} />
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs">
			<a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> /
			<a href={localePath(locale, '/procurement')}>{t(locale, 'navProcurement')}</a>
		</p>
		<h1>{item.title}</h1>
		<p class="proc-meta">
			<span class="badge">{t(locale, item.kind === 'auction' ? 'auctions' : 'tenders')}</span>
			<DeadlineBadge {locale} deadlineAt={item.deadlineAt} status={item.status} />
		</p>
	</div>
</div>

<div class="container section detail-grid">
	<div>
		<LangNotice {locale} fallback={item.fallback} machine={item.machine} />

		{#if item.status === 'amended' && item.amendmentSummary}
			<div class="notice notice-amber" role="note">
				<strong>{t(locale, 'amendment')}:</strong>&nbsp;{item.amendmentSummary}
				{#if item.previousDeadlineAt}
					&nbsp;({t(locale, 'previousDeadline')}: {formatDateTime(locale, item.previousDeadlineAt)})
				{/if}
			</div>
		{/if}

		<div class="prose">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html item.bodyHtml}
		</div>

		{#if item.docs.length > 0}
			<h2 class="docs-head">{t(locale, 'documentsAttached')}</h2>
			{#each item.docs as doc (doc.mediaId)}
				<a class="doc-row" href={mediaFileUrl(doc.mediaId)} target="_blank" rel="noopener">
					<span class="doc-icon">PDF</span>
					<span class="doc-title">
						{doc.title}
						{#if doc.revision > 1}<span class="badge badge-amber">rev. {doc.revision}</span>{/if}
					</span>
					<span class="doc-size">{formatBytes(doc.size)}</span>
				</a>
			{/each}
		{/if}

		<p class="notice legal-note" role="note">{t(locale, 'georgianControlling')}</p>
	</div>

	<aside class="fact-box">
		<dl>
			{#if item.publishedAt}
				<dt>{t(locale, 'published')}</dt>
				<dd>{formatDate(locale, item.publishedAt)}</dd>
			{/if}
			{#if item.deadlineAt}
				<dt>{t(locale, 'deadline')}</dt>
				<dd class:passed={item.deadlinePassed}>{formatDateTime(locale, item.deadlineAt)}</dd>
			{/if}
			{#if item.amendsSlug}
				<dt>{t(locale, 'amendment')}</dt>
				<dd>
					<a href={localePath(locale, `/procurement/${item.amendsSlug}`)}>#{item.amendsSlug}</a>
				</dd>
			{/if}
		</dl>
	</aside>
</div>

<style>
	.proc-meta {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin: var(--sp-2) 0 0;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: var(--sp-6);
		align-items: start;
	}

	@media (max-width: 1023px) {
		.detail-grid {
			grid-template-columns: 1fr;
		}
	}

	.fact-box {
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		border-radius: var(--radius);
		padding: var(--sp-3);
		position: sticky;
		top: 5.5rem;
	}

	.fact-box dl {
		margin: 0;
		display: grid;
		gap: var(--sp-2);
	}

	.fact-box dt {
		font-size: var(--fs-xs);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--c-ink-500);
		font-weight: 700;
	}

	.fact-box dd {
		margin: 0.125rem 0 0;
		font-weight: 600;
		color: var(--c-primary-900);
	}

	.fact-box dd.passed {
		color: var(--c-red-600);
	}

	.docs-head {
		margin-top: var(--sp-6);
		font-size: var(--fs-xl);
	}

	.legal-note {
		margin-top: var(--sp-6);
	}
</style>
