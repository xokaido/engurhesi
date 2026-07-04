<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';
	import MediaImage from '$lib/components/MediaImage.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
</script>

<svelte:head>
	<title>{t(locale, 'navProjects')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={t(locale, 'ourProjects')} />
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs"><a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'navProjects')}</p>
		<h1>{t(locale, 'navProjects')}</h1>
	</div>
</div>

<div class="container section">
	{#if data.projects.length > 0}
		<div class="project-grid">
			{#each data.projects as project (project.slug)}
				<article class="card project-card">
					<div class="card-media">
						{#if project.cover}
							<MediaImage media={project.cover} preset="card" />
						{/if}
					</div>
					<div class="card-body">
						<h2 class="card-title">
							<a href={localePath(locale, `/projects/${project.slug}`)}>{project.title}</a>
						</h2>
						{#if project.summary}
							<p class="card-excerpt">{project.summary}</p>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<p class="empty">{t(locale, 'emptyList')}</p>
	{/if}
</div>

<style>
	.project-grid {
		display: grid;
		gap: var(--sp-3);
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
	}

	.project-card .card-title {
		font-size: var(--fs-xl);
	}
</style>
