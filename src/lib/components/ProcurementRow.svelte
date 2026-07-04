<script lang="ts">
	import { formatDate, formatDateTime, localePath, t, type Locale } from '$lib/i18n';
	import DeadlineBadge from './DeadlineBadge.svelte';

	let {
		locale,
		item
	}: {
		locale: Locale;
		item: {
			slug: string;
			kind: string;
			status: string;
			title: string;
			publishedAt: string | null;
			deadlineAt: string | null;
		};
	} = $props();
</script>

<a class="proc-row" href={localePath(locale, `/procurement/${item.slug}`)}>
	<div class="proc-main">
		<span class="badge">{t(locale, item.kind === 'auction' ? 'auctions' : 'tenders')}</span>
		<span class="proc-title">{item.title}</span>
	</div>
	<div class="proc-side">
		{#if item.publishedAt}
			<span class="muted proc-date">
				{t(locale, 'published')}: {formatDate(locale, item.publishedAt)}
			</span>
		{/if}
		{#if item.deadlineAt}
			<span class="muted proc-date">
				{t(locale, 'deadline')}: {formatDateTime(locale, item.deadlineAt)}
			</span>
		{/if}
		<DeadlineBadge {locale} deadlineAt={item.deadlineAt} status={item.status} />
	</div>
</a>

<style>
	.proc-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-2);
		padding: var(--sp-2);
		background: var(--c-surface);
		border: 1px solid var(--c-line);
		border-radius: var(--radius-sm);
		margin-bottom: 0.625rem;
		text-decoration: none;
		color: inherit;
		flex-wrap: wrap;
	}

	.proc-row:hover {
		border-color: var(--c-accent-500);
		box-shadow: var(--shadow-card);
	}

	.proc-main {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1 1 20rem;
		min-width: 0;
	}

	.proc-title {
		font-weight: 600;
		color: var(--c-primary-900);
	}

	.proc-side {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.proc-date {
		font-size: var(--fs-xs);
	}
</style>
