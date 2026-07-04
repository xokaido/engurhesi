<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';
	import { mediaVideoUrl } from '$lib/types';
	import MediaImage from '$lib/components/MediaImage.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);

	/** facade pattern — no video bytes / iframes until the user clicks */
	let activeVideo: string | null = $state(null);
</script>

<svelte:head>
	<title>{t(locale, 'navMedia')} — {t(locale, 'siteName')}</title>
	<meta name="description" content={t(locale, 'navMedia')} />
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs"><a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> / {t(locale, 'navMedia')}</p>
		<h1>{t(locale, 'navMedia')}</h1>
	</div>
</div>

<div class="container section">
	<ul class="pills">
		<li>
			<a class="pill" href={localePath(locale, '/media')} aria-current={data.tab === 'photos' ? 'true' : undefined}>
				{t(locale, 'photos')}
			</a>
		</li>
		<li>
			<a class="pill" href={localePath(locale, '/media?tab=videos')} aria-current={data.tab === 'videos' ? 'true' : undefined}>
				{t(locale, 'videos')}
			</a>
		</li>
	</ul>

	{#if data.tab === 'photos'}
		{#if data.albums.length > 0}
			<div class="card-grid">
				{#each data.albums as album (album.slug)}
					<article class="card">
						<div class="card-media">
							{#if album.cover}
								<MediaImage media={album.cover} preset="card" />
							{/if}
						</div>
						<div class="card-body">
							<h2 class="card-title">
								<a href={localePath(locale, `/media/${album.slug}`)}>{album.title}</a>
							</h2>
							<p class="card-meta">{album.count} {t(locale, 'photosCount')}</p>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<p class="empty">{t(locale, 'emptyList')}</p>
		{/if}
	{:else if data.videos.length > 0}
		<div class="card-grid">
			{#each data.videos as video (video.slug)}
				<article class="card video-card">
					{#if activeVideo === video.slug}
						{#if video.videoMediaId}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video controls autoplay preload="metadata" src={mediaVideoUrl(video.videoMediaId)}></video>
						{:else if video.youtubeId}
							<iframe
								src="https://www.youtube-nocookie.com/embed/{video.youtubeId}?autoplay=1"
								title={video.title}
								allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
								allowfullscreen
							></iframe>
						{/if}
					{:else}
						<button
							class="video-facade"
							type="button"
							onclick={() => (activeVideo = video.slug)}
							aria-label="{t(locale, 'playVideo')}: {video.title}"
						>
							{#if video.thumb}
								<MediaImage media={video.thumb} preset="card" />
							{/if}
							<span class="play-btn" aria-hidden="true">
								<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
									<path d="M8 5v14l11-7z" />
								</svg>
							</span>
						</button>
					{/if}
					<div class="card-body">
						<h2 class="card-title video-title">{video.title}</h2>
						{#if video.description}
							<p class="card-excerpt">{video.description}</p>
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
	.video-card video,
	.video-card iframe {
		width: 100%;
		aspect-ratio: 16 / 9;
		border: none;
		background: #000;
		display: block;
	}

	.video-facade {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		border: none;
		padding: 0;
		cursor: pointer;
		background: linear-gradient(145deg, var(--c-primary-800), var(--c-accent-600));
		overflow: hidden;
	}

	.video-facade :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.play-btn {
		position: absolute;
		inset: 0;
		margin: auto;
		width: 4rem;
		height: 4rem;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: rgb(7 42 66 / 0.75);
		color: #fff;
		transition: background 0.15s ease, scale 0.15s ease;
	}

	.video-facade:hover .play-btn {
		background: var(--c-accent-600);
		scale: 1.08;
	}

	.video-title {
		font-size: var(--fs-base);
	}
</style>
