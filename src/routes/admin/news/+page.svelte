<script lang="ts">
	import { formatDate } from '$lib/i18n';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>სიახლეები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>სიახლეები</h1>
	<form method="GET" class="actions-row">
		<input type="search" name="q" value={data.q} placeholder="ძიება…" />
		<button class="btn btn-sm btn-outline" type="submit">ძიება</button>
	</form>
</div>

{#if form?.error}
	<p class="err-msg" role="alert">{form.error}</p>
{/if}

<div class="panel">
	<h2>ახალი სიახლე</h2>
	<form method="POST" action="?/create" class="actions-row">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="სათაური (ქართულად)" required style="flex: 1; min-width: 16rem;" />
		<select name="category">
			<option value="news">სიახლე</option>
			<option value="announcement">განცხადება</option>
			<option value="publication">პუბლიკაცია</option>
		</select>
		<button class="btn" type="submit">შექმნა</button>
	</form>
</div>

<table class="admin">
	<thead>
		<tr>
			<th>სათაური</th>
			<th>კატეგორია</th>
			<th>სტატუსი</th>
			<th>თარიღი</th>
		</tr>
	</thead>
	<tbody>
		{#each data.items as item (item.id)}
			<tr>
				<td><a href="/admin/news/{item.id}">{item.title || item.slug}</a></td>
				<td>
					{item.category === 'news'
						? 'სიახლე'
						: item.category === 'announcement'
							? 'განცხადება'
							: 'პუბლიკაცია'}
				</td>
				<td>
					<span class="badge {item.status === 'published' ? 'badge-green' : 'badge-amber'}">
						{item.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
					</span>
				</td>
				<td class="muted">{formatDate('ka', item.publishedAt ?? item.updatedAt)}</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="muted">ჩანაწერები არ არის</td></tr>
		{/each}
	</tbody>
</table>
