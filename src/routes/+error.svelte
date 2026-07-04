<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — engurhesi.ge</title>
</svelte:head>

<main style="max-width: 40rem; margin: 4rem auto; padding: 0 1.5rem; text-align: center;">
	<h1 style="font-size: 4rem; margin: 0;">{page.status}</h1>
	<p>{page.error?.message ?? 'Something went wrong.'}</p>
	<p><a href="/ka">engurhesi.ge</a></p>
</main>
