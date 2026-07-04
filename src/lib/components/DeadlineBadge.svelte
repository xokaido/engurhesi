<script lang="ts">
	import { daysUntil, t, type Locale } from '$lib/i18n';

	let {
		locale,
		deadlineAt,
		status
	}: { locale: Locale; deadlineAt: string | null; status: string } = $props();

	const days = $derived(deadlineAt ? daysUntil(deadlineAt) : null);

	const statusKey = $derived.by(() => {
		switch (status) {
			case 'closed':
				return 'procStatusClosed' as const;
			case 'canceled':
				return 'procStatusCanceled' as const;
			case 'awarded':
				return 'procStatusAwarded' as const;
			case 'archived':
				return 'procStatusArchived' as const;
			case 'amended':
				return 'procStatusAmended' as const;
			default:
				return null;
		}
	});
</script>

{#if statusKey && status !== 'amended'}
	<span class="badge badge-neutral">{t(locale, statusKey)}</span>
{:else if days !== null && days <= 0}
	<span class="badge badge-red">{t(locale, 'deadlinePassed')}</span>
{:else if days !== null && days <= 7}
	<span class="badge badge-amber">{days} {t(locale, 'daysLeft')}</span>
{:else if days !== null}
	<span class="badge badge-green">{days} {t(locale, 'daysLeft')}</span>
{:else}
	<span class="badge badge-green">{t(locale, 'procStatusPublished')}</span>
{/if}
{#if status === 'amended'}
	<span class="badge badge-amber">{t(locale, 'procStatusAmended')}</span>
{/if}
