<script lang="ts">
	let {
		page,
		pages,
		makeHref
	}: { page: number; pages: number; makeHref: (page: number) => string } = $props();

	const windowed = $derived.by(() => {
		const items: number[] = [];
		for (let p = 1; p <= pages; p++) {
			if (p === 1 || p === pages || Math.abs(p - page) <= 2) items.push(p);
		}
		return items;
	});
</script>

{#if pages > 1}
	<nav class="pagination" aria-label="Pagination">
		{#each windowed as p, i (p)}
			{#if i > 0 && windowed[i - 1] !== p - 1}
				<span aria-hidden="true">…</span>
			{/if}
			{#if p === page}
				<span aria-current="page">{p}</span>
			{:else}
				<a href={makeHref(p)}>{p}</a>
			{/if}
		{/each}
	</nav>
{/if}
