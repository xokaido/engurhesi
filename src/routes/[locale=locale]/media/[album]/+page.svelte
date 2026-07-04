<script lang="ts">
	import { localePath, t, type Locale } from '$lib/i18n';
	import { mediaImgUrl } from '$lib/types';
	import MediaImage from '$lib/components/MediaImage.svelte';

	let { data } = $props();
	const locale = $derived(data.locale as Locale);
	const album = $derived(data.album);

	let dialog: HTMLDialogElement | undefined = $state();
	let current = $state(0);

	function open(index: number) {
		current = index;
		dialog?.showModal();
	}

	function step(delta: number) {
		const n = album.items.length;
		current = (current + delta + n) % n;
	}

	function onKeydown(event: KeyboardEvent) {
		if (!dialog?.open) return;
		if (event.key === 'ArrowRight') step(1);
		if (event.key === 'ArrowLeft') step(-1);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>{album.title} — {t(locale, 'navMedia')} — {t(locale, 'siteName')}</title>
	{#if album.description}
		<meta name="description" content={album.description} />
	{/if}
</svelte:head>

<div class="page-hero">
	<div class="container">
		<p class="crumbs">
			<a href={localePath(locale, '/')}>{t(locale, 'navHome')}</a> /
			<a href={localePath(locale, '/media')}>{t(locale, 'navMedia')}</a>
		</p>
		<h1>{album.title}</h1>
	</div>
</div>

<div class="container section">
	{#if album.description}
		<p class="muted album-desc">{album.description}</p>
	{/if}

	<div class="photo-grid">
		{#each album.items as item, i (item.id)}
			<button type="button" class="photo-cell" onclick={() => open(i)} aria-label={item.alt || album.title}>
				<MediaImage media={item} preset="card" />
			</button>
		{/each}
	</div>
</div>

<dialog bind:this={dialog} class="lightbox" closedby="any">
	{#if album.items[current]}
		<img
			src={mediaImgUrl(album.items[current].id, 'hero')}
			alt={album.items[current].alt || album.title}
		/>
	{/if}
	<div class="lightbox-bar">
		<button type="button" class="lb-btn" onclick={() => step(-1)} aria-label={t(locale, 'prevPage')}>‹</button>
		<span>{current + 1} / {album.items.length}</span>
		<button type="button" class="lb-btn" onclick={() => step(1)} aria-label={t(locale, 'nextPage')}>›</button>
		<button type="button" class="lb-btn lb-close" onclick={() => dialog?.close()} aria-label="Close">✕</button>
	</div>
</dialog>

<style>
	.album-desc {
		max-width: var(--maxw-prose);
		margin-bottom: var(--sp-4);
	}

	.photo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--sp-2);
	}

	.photo-cell {
		padding: 0;
		border: none;
		background: none;
		cursor: zoom-in;
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.photo-cell :global(img) {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		transition: scale 0.2s ease;
	}

	.photo-cell:hover :global(img) {
		scale: 1.03;
	}

	.lightbox {
		border: none;
		background: transparent;
		padding: 0;
		max-width: min(92vw, 70rem);
		max-height: 92vh;
	}

	.lightbox::backdrop {
		background: rgb(7 42 66 / 0.92);
	}

	.lightbox img {
		max-width: 100%;
		max-height: 82vh;
		border-radius: var(--radius);
		margin-inline: auto;
	}

	.lightbox-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--sp-2);
		color: #fff;
		padding-top: var(--sp-2);
		font-variant-numeric: tabular-nums;
	}

	.lb-btn {
		min-width: 44px;
		min-height: 44px;
		border: 1px solid rgb(255 255 255 / 0.4);
		background: rgb(255 255 255 / 0.1);
		color: #fff;
		border-radius: 999px;
		font-size: 1.25rem;
		cursor: pointer;
	}

	.lb-btn:hover {
		background: rgb(255 255 255 / 0.25);
	}
</style>
