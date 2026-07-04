<script lang="ts">
	import { mediaFileUrl } from '$lib/types';

	let { data, form } = $props();

	const CATEGORY_LABEL: Record<string, string> = {
		financial: 'ფინანსური',
		legal: 'სამართლებრივი',
		other: 'სხვა'
	};

	function filesFor(documentId: string) {
		return data.files.filter((f) => f.documentId === documentId);
	}
</script>

<svelte:head>
	<title>დოკუმენტები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>დოკუმენტები (ანგარიშები)</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.created}<p class="ok-msg" role="status">დოკუმენტი შეიქმნა</p>{/if}
{#if form?.fileAdded}<p class="ok-msg" role="status">ფაილი დაემატა</p>{/if}
{#if form?.titleSaved}<p class="ok-msg" role="status">სათაური შენახულია</p>{/if}
{#if form?.published}<p class="ok-msg" role="status">გამოქვეყნდა</p>{/if}
{#if form?.unpublished}<p class="ok-msg" role="status">გამოქვეყნება გაუქმდა</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<div class="panel">
	<h2>ახალი დოკუმენტი</h2>
	<form method="POST" action="?/create" enctype="multipart/form-data" class="actions-row">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="სათაური (ქართულად)" required style="flex: 1; min-width: 14rem;" />
		<select name="category">
			<option value="financial">ფინანსური</option>
			<option value="legal">სამართლებრივი</option>
			<option value="other">სხვა</option>
		</select>
		<input type="number" name="year" placeholder="წელი" min="1990" max="2100" style="width: 6rem;" />
		<input type="file" name="file" accept="application/pdf" required />
		<button class="btn" type="submit">შექმნა</button>
	</form>
</div>

{#each data.items as item (item.id)}
	<div class="panel">
		<div class="admin-head" style="margin-bottom: var(--sp-2);">
			<h2>
				{item.title || item.slug}
				<span class="muted" style="font-weight: normal;">
					· {CATEGORY_LABEL[item.category]}{item.year ? ` · ${item.year}` : ''}
				</span>
			</h2>
			<div class="actions-row">
				<span class="badge {item.status === 'published' ? 'badge-green' : 'badge-amber'}">
					{item.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
				</span>
				<form method="POST" action={item.status === 'published' ? '?/unpublish' : '?/publish'}>
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="document_id" value={item.id} />
					<button class="btn btn-sm btn-outline" type="submit">
						{item.status === 'published' ? 'გაუქმება' : 'გამოქვეყნება'}
					</button>
				</form>
				{#if data.role === 'admin'}
					<form
						method="POST"
						action="?/delete"
						onsubmit={(e) => {
							if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
						}}
					>
						<input type="hidden" name="csrf" value={data.csrf} />
						<input type="hidden" name="document_id" value={item.id} />
						<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
					</form>
				{/if}
			</div>
		</div>

		<div class="actions-row" style="flex-wrap: wrap; gap: var(--sp-2);">
			{#each filesFor(item.id) as file (file.mediaId)}
				<a class="badge badge-neutral" href={mediaFileUrl(file.mediaId)} target="_blank" rel="noopener">
					{file.locale?.toUpperCase()}: {file.filename}
				</a>
			{/each}
		</div>

		<details style="margin-top: var(--sp-2);">
			<summary class="muted">სათაურის თარგმანი / ფაილის დამატება</summary>
			<div class="actions-row" style="margin-top: var(--sp-2); flex-wrap: wrap;">
				<form method="POST" action="?/setTitle" class="actions-row">
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="document_id" value={item.id} />
					<select name="locale">
						<option value="ka">ქა</option>
						<option value="en">EN</option>
						<option value="ru">РУ</option>
					</select>
					<input type="text" name="title" placeholder="სათაური" required />
					<button class="btn btn-sm btn-outline" type="submit">შენახვა</button>
				</form>
				<form method="POST" action="?/addFile" enctype="multipart/form-data" class="actions-row">
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="document_id" value={item.id} />
					<select name="locale">
						<option value="ka">ქა</option>
						<option value="en">EN</option>
						<option value="ru">РУ</option>
					</select>
					<input type="file" name="file" accept="application/pdf" required />
					<button class="btn btn-sm btn-outline" type="submit">ფაილის ატვირთვა</button>
				</form>
			</div>
		</details>
	</div>
{:else}
	<p class="muted">ჩანაწერები არ არის</p>
{/each}
