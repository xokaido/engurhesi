<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>პროექტები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>პროექტები</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}

<div class="panel">
	<h2>ახალი პროექტი</h2>
	<form method="POST" action="?/create" class="actions-row">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="სათაური (ქართულად)" required style="flex: 1; min-width: 16rem;" />
		<button class="btn" type="submit">შექმნა</button>
	</form>
</div>

<table class="admin">
	<thead>
		<tr><th>სათაური</th><th>Slug</th><th>რიგი</th><th>სტატუსი</th></tr>
	</thead>
	<tbody>
		{#each data.items as item (item.id)}
			<tr>
				<td><a href="/admin/projects/{item.id}">{item.title || item.slug}</a></td>
				<td class="muted">/projects/{item.slug}</td>
				<td>{item.sort}</td>
				<td>
					<span class="badge {item.status === 'published' ? 'badge-green' : 'badge-amber'}">
						{item.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
					</span>
				</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="muted">ჩანაწერები არ არის</td></tr>
		{/each}
	</tbody>
</table>
