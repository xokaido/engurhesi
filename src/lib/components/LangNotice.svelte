<script lang="ts">
	import { t, type Locale } from '$lib/i18n';

	let {
		locale,
		fallback = false,
		machine = false
	}: { locale: Locale; fallback?: boolean; machine?: boolean } = $props();
</script>

{#if fallback && locale !== 'ka'}
	<p class="notice" role="note">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
			<path d="M12 8v5m0 3v.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		</svg>
		{t(locale, 'fallbackNotice')}
	</p>
{:else if machine}
	<p class="notice notice-amber" role="note">
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M4 5h7M7 3v2c0 3.5-2 6.5-4 8m2-4c1 2 3 4 5 5m1 6 4-10 4 10m-7-3h6"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
		</svg>
		{t(locale, 'machineTranslated')}
	</p>
{/if}
