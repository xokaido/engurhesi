<script lang="ts">
	import { formatBytes, mediaImgUrl } from '$lib/types';
	import { formatDate } from '$lib/i18n';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>მედია — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>მედია ბიბლიოთეკა</h1>
	<nav class="actions-row">
		<a class="btn btn-sm {!data.kind ? '' : 'btn-outline'}" href="/admin/media">ყველა</a>
		<a class="btn btn-sm {data.kind === 'image' ? '' : 'btn-outline'}" href="/admin/media?kind=image">სურათები</a>
		<a class="btn btn-sm {data.kind === 'document' ? '' : 'btn-outline'}" href="/admin/media?kind=document">დოკუმენტები</a>
		<a class="btn btn-sm {data.kind === 'video' ? '' : 'btn-outline'}" href="/admin/media?kind=video">ვიდეო</a>
	</nav>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.uploaded}<p class="ok-msg" role="status">ფაილი აიტვირთა და გადამოწმდა</p>{/if}
{#if form?.altSaved}<p class="ok-msg" role="status">აღწერა შენახულია</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<div class="panel">
	<h2>ატვირთვა</h2>
	<form method="POST" action="?/upload" enctype="multipart/form-data" class="actions-row" style="flex-wrap: wrap;">
		<input type="hidden" name="csrf" value={data.csrf} />
		<select name="kind">
			<option value="image">სურათი</option>
			<option value="document">დოკუმენტი (PDF)</option>
			<option value="video">ვიდეო</option>
		</select>
		<input type="file" name="file" required />
		<input type="text" name="alt" placeholder="ალტ-ტექსტი (სურათებისთვის)" style="flex: 1; min-width: 14rem;" />
		<button class="btn" type="submit">ატვირთვა</button>
	</form>
	<p class="muted" style="margin-top: var(--sp-1); font-size: 0.85rem;">
		ლიმიტები: სურათი ≤ 15 MB · PDF ≤ 50 MB. ფაილები მოწმდება ტიპზე (magic bytes) ატვირთვისას.
	</p>
</div>

<div class="media-grid">
	{#each data.items as item (item.id)}
		<div class="panel media-cell">
			{#if item.kind === 'image' && item.status === 'active'}
				<img src={mediaImgUrl(item.id, 'thumb')} alt={item.altKa ?? item.filename} loading="lazy" />
			{:else}
				<div class="media-placeholder">{item.kind === 'document' ? 'PDF' : item.kind}</div>
			{/if}
			<div class="media-meta">
				<strong title={item.filename}>{item.filename}</strong>
				<span class="muted">
					{formatBytes(item.size)}{item.width ? ` · ${item.width}×${item.height}` : ''} ·
					{formatDate('ka', item.createdAt)}
				</span>
				<span
					class="badge {item.status === 'active'
						? 'badge-green'
						: item.status === 'rejected'
							? 'badge-red'
							: 'badge-amber'}"
				>
					{item.status}
				</span>
			</div>
			{#if item.kind === 'image'}
				<form method="POST" action="?/setAlt" class="actions-row" style="margin-top: var(--sp-1);">
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="media_id" value={item.id} />
					<input type="hidden" name="locale" value="ka" />
					<input type="text" name="alt" value={item.altKa ?? ''} placeholder="ალტ-ტექსტი" style="flex: 1;" />
					<button class="btn btn-sm btn-outline" type="submit">OK</button>
				</form>
			{/if}
			{#if data.role === 'admin'}
				<form
					method="POST"
					action="?/delete"
					style="margin-top: var(--sp-1);"
					onsubmit={(e) => {
						if (!confirm('ნამდვილად წაიშალოს? ფაილი R2-დანაც წაიშლება.')) e.preventDefault();
					}}
				>
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="media_id" value={item.id} />
					<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
				</form>
			{/if}
		</div>
	{:else}
		<p class="muted">ფაილები არ არის</p>
	{/each}
</div>

<style>
	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
		gap: var(--sp-2);
	}
	.media-cell img {
		width: 100%;
		height: 8rem;
		object-fit: cover;
		border-radius: 4px;
	}
	.media-placeholder {
		width: 100%;
		height: 8rem;
		display: grid;
		place-items: center;
		background: var(--c-bg-alt, #f1f5f9);
		border-radius: 4px;
		color: var(--c-muted, #64748b);
		font-weight: 600;
		text-transform: uppercase;
	}
	.media-meta {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-top: var(--sp-1);
		font-size: 0.85rem;
		overflow-wrap: anywhere;
	}
</style>
