<script lang="ts">
	import { formatDateTime } from '$lib/i18n';

	let { data } = $props();
</script>

<svelte:head>
	<title>აუდიტი — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>აუდიტის ჟურნალი</h1>
</div>

<table class="admin">
	<thead>
		<tr><th>დრო</th><th>ვინ</th><th>მოქმედება</th><th>ობიექტი</th><th>მიზეზი / დეტალები</th></tr>
	</thead>
	<tbody>
		{#each data.items as item (item.id)}
			<tr>
				<td class="muted" style="white-space: nowrap;">{formatDateTime('ka', item.createdAt)}</td>
				<td>{item.actorEmail ?? 'system'}</td>
				<td><code>{item.action}</code></td>
				<td class="muted">{item.entityType}{item.entityId ? ` · ${item.entityId.slice(0, 8)}` : ''}</td>
				<td class="muted" style="max-width: 24rem; overflow-wrap: anywhere;">
					{item.reason ?? ''}
					{#if item.detailJson}<code style="font-size: 0.75rem;">{item.detailJson}</code>{/if}
				</td>
			</tr>
		{:else}
			<tr><td colspan="5" class="muted">ჩანაწერები არ არის</td></tr>
		{/each}
	</tbody>
</table>

{#if data.totalPages > 1}
	<nav class="actions-row" style="margin-top: var(--sp-2);" aria-label="Pagination">
		{#if data.page > 1}
			<a class="btn btn-sm btn-outline" href="?page={data.page - 1}">← წინა</a>
		{/if}
		<span class="muted">{data.page} / {data.totalPages}</span>
		{#if data.page < data.totalPages}
			<a class="btn btn-sm btn-outline" href="?page={data.page + 1}">შემდეგი →</a>
		{/if}
	</nav>
{/if}
