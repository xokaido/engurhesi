<script lang="ts">
	import { formatDateTime } from '$lib/i18n';

	let { data, form } = $props();

	const STATUS_LABEL: Record<string, string> = {
		draft: 'მონახაზი',
		published: 'გამოქვეყნებული',
		closed: 'დახურული',
		amended: 'შეცვლილი',
		canceled: 'გაუქმებული',
		awarded: 'დასრულებული',
		archived: 'არქივი'
	};
</script>

<svelte:head>
	<title>შესყიდვები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>შესყიდვები</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}

<div class="panel">
	<h2>ახალი შესყიდვა</h2>
	<form method="POST" action="?/create" class="actions-row">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="სათაური (ქართულად)" required style="flex: 1; min-width: 16rem;" />
		<select name="kind">
			<option value="tender">ტენდერი</option>
			<option value="auction">აუქციონი</option>
		</select>
		<label class="actions-row" style="gap: 0.375rem;">
			<span class="muted">ვადა (თბილისი):</span>
			<input type="datetime-local" name="deadline" />
		</label>
		<button class="btn" type="submit">შექმნა</button>
	</form>
</div>

<table class="admin">
	<thead>
		<tr><th>სათაური</th><th>ტიპი</th><th>სტატუსი</th><th>ვადა</th></tr>
	</thead>
	<tbody>
		{#each data.items as item (item.id)}
			<tr>
				<td><a href="/admin/procurement/{item.id}">{item.title || item.slug}</a></td>
				<td>{item.kind === 'tender' ? 'ტენდერი' : 'აუქციონი'}</td>
				<td>
					<span
						class="badge {item.status === 'published'
							? 'badge-green'
							: item.status === 'draft'
								? 'badge-amber'
								: 'badge-neutral'}"
					>
						{STATUS_LABEL[item.status] ?? item.status}
					</span>
				</td>
				<td class="muted">{item.deadlineAt ? formatDateTime('ka', item.deadlineAt) : '—'}</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="muted">ჩანაწერები არ არის</td></tr>
		{/each}
	</tbody>
</table>
