<script lang="ts">
	import { mediaImgUrl, type ImagePresetName, type MediaRef } from '$lib/types';

	let {
		media,
		preset = 'card',
		alt,
		loading = 'lazy',
		fetchpriority
	}: {
		media: MediaRef;
		preset?: ImagePresetName;
		alt?: string;
		loading?: 'lazy' | 'eager';
		fetchpriority?: 'high' | 'low' | 'auto';
	} = $props();
</script>

<img
	src={mediaImgUrl(media.id, preset)}
	alt={alt ?? media.alt}
	width={media.width ?? undefined}
	height={media.height ?? undefined}
	{loading}
	{fetchpriority}
	decoding="async"
	style:background-color={media.placeholderColor ?? 'var(--c-primary-100)'}
/>
