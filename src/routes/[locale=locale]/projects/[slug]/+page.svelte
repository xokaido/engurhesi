<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';
	import LangNotice from '$lib/components/LangNotice.svelte';
	import MediaImage from '$lib/components/MediaImage.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
	const project = $derived(data.project);
</script>

<svelte:head>
	<title>{project.title} — {t(locale, 'navProjects')} — {t(locale, 'siteName')}</title>
	{#if project.summary}
		<meta name="description" content={project.summary} />
	{/if}
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs">
			<a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> /
			<a href={localePath(locale, '/projects')}>{t(locale, 'navProjects')}</a>
		</p>
		<h1>{project.title}</h1>
	</div>
</div>

<div class="container section detail-grid">
	<div>
		<LangNotice {locale} fallback={project.fallback} machine={project.machine} />

		{#if project.cover}
			<div class="project-cover">
				<MediaImage media={project.cover} preset="hero" loading="eager" fetchpriority="high" />
			</div>
		{/if}

		<div class="prose">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html project.bodyHtml}
		</div>
	</div>

	{#if project.facts.length > 0}
		<aside class="fact-box">
			<dl>
				{#each project.facts as fact (fact.label)}
					<div>
						<dt>{fact.label}</dt>
						<dd>{fact.value}</dd>
					</div>
				{/each}
			</dl>
		</aside>
	{/if}
</div>

<style>
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

	.project-cover {
		margin-bottom: var(--sp-4);
	}

	.project-cover :global(img) {
		border-radius: var(--radius);
		width: 100%;
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
</style>
