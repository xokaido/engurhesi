<script lang="ts">
	import { formatDate, localePath, t, type Locale } from '$lib/i18n';
	import { mediaImgUrl } from '$lib/types';
	import LangNotice from '$lib/components/LangNotice.svelte';
	import MediaImage from '$lib/components/MediaImage.svelte';
	import NewsCard from '$lib/components/NewsCard.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
	const article = $derived(data.article);

	const categoryKey = $derived(
		article.category === 'announcement'
			? ('categoryAnnouncement' as const)
			: article.category === 'publication'
				? ('categoryPublication' as const)
				: ('categoryNews' as const)
	);
</script>

<svelte:head>
	<title>{article.title} — {t(locale, 'siteName')}</title>
	{#if article.seoDescription ?? article.excerpt}
		<meta name="description" content={article.seoDescription ?? article.excerpt} />
	{/if}
	<meta property="og:title" content={article.title} />
	<meta property="og:type" content="article" />
	{#if article.cover}
		<meta property="og:image" content={mediaImgUrl(article.cover.id, 'hero')} />
	{/if}
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'NewsArticle',
		headline: article.title,
		datePublished: article.publishedAt,
		inLanguage: locale
	})}</${'script'}>`}
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs">
			<a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> /
			<a href={localePath(locale, '/news')}>{t(locale, 'navNews')}</a>
		</p>
		<h1>{article.title}</h1>
		<p class="article-meta">
			<span class="badge">{t(locale, categoryKey)}</span>
			{#if article.publishedAt}
				<time datetime={article.publishedAt}>{formatDate(locale, article.publishedAt)}</time>
			{/if}
		</p>
	</div>
</div>

<div class="container section">
	<LangNotice {locale} fallback={article.fallback} machine={article.machine} />

	{#if article.cover}
		<div class="article-cover">
			<MediaImage media={article.cover} preset="hero" loading="eager" fetchpriority="high" />
		</div>
	{/if}

	<div class="prose">
		<!-- Server-rendered from validated ProseMirror JSON by a strict allowlist renderer -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html article.bodyHtml}
	</div>

	{#if data.gallery.length > 0}
		<div class="gallery-grid">
			{#each data.gallery as image (image.id)}
				<a href={mediaImgUrl(image.id, 'hero')} target="_blank" rel="noopener">
					<MediaImage media={image} preset="card" />
				</a>
			{/each}
		</div>
	{/if}

	{#if data.more.length > 0}
		<div class="section-head more-head">
			<h2>{t(locale, 'moreNews')}</h2>
			<a class="section-link" href={localePath(locale, '/news')}>{t(locale, 'allNews')}</a>
		</div>
		<div class="card-grid">
			{#each data.more as item (item.slug)}
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
	{/if}
</div>

<style>
	.article-meta {
		display: flex;
		gap: var(--sp-2);
		align-items: center;
		margin: var(--sp-2) 0 0;
		color: rgb(255 255 255 / 0.8);
		font-size: var(--fs-sm);
	}

	.article-cover {
		max-width: var(--maxw-prose);
		margin-bottom: var(--sp-4);
	}

	.article-cover :global(img) {
		border-radius: var(--radius);
		width: 100%;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--sp-2);
		margin-top: var(--sp-6);
	}

	.gallery-grid :global(img) {
		border-radius: var(--radius-sm);
		aspect-ratio: 4 / 3;
		object-fit: cover;
		width: 100%;
	}

	.more-head {
		margin-top: var(--sp-8);
	}
</style>
