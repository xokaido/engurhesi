<script lang="ts">
	import { mediaImgUrl } from '$lib/types';

	let { data, form } = $props();

	function nameFor(partnerId: string, locale: string): string {
		return data.i18n.find((r) => r.partnerId === partnerId && r.locale === locale)?.name ?? '';
	}
</script>

<svelte:head>
	<title>პარტნიორები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>პარტნიორები</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.created || form?.saved}<p class="ok-msg" role="status">შენახულია</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<div class="panel">
	<h2>ახალი პარტნიორი</h2>
	<form method="POST" action="?/create" class="actions-row" style="flex-wrap: wrap;">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="name" placeholder="სახელი (ქართულად)" required style="flex: 1; min-width: 12rem;" />
		<input type="url" name="url" placeholder="https://..." />
		<select name="logo">
			<option value="">— ლოგო —</option>
			{#each data.logos as logo (logo.id)}
				<option value={logo.id}>{logo.filename}</option>
			{/each}
		</select>
		<button class="btn" type="submit">დამატება</button>
	</form>
</div>

{#each data.items as item (item.id)}
	<div class="panel">
		<div class="actions-row" style="flex-wrap: wrap; align-items: flex-start;">
			{#if item.logoMediaId}
				<img src={mediaImgUrl(item.logoMediaId, 'thumb')} alt="" style="height: 3rem;" />
			{/if}
			<form method="POST" action="?/update" class="actions-row" style="flex: 1; flex-wrap: wrap;">
				<input type="hidden" name="csrf" value={data.csrf} />
				<input type="hidden" name="partner_id" value={item.id} />
				<strong style="min-width: 10rem;">{nameFor(item.id, 'ka')}</strong>
				<input type="url" name="url" value={item.url ?? ''} placeholder="URL" />
				<select name="logo">
					<option value="">— ლოგო —</option>
					{#each data.logos as logo (logo.id)}
						<option value={logo.id} selected={item.logoMediaId === logo.id}>{logo.filename}</option>
					{/each}
				</select>
				<input type="number" name="sort" value={item.sort} style="width: 4.5rem;" />
				<button class="btn btn-sm btn-outline" type="submit">შენახვა</button>
			</form>
			<form
				method="POST"
				action="?/delete"
				onsubmit={(e) => {
					if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
				}}
			>
				<input type="hidden" name="csrf" value={data.csrf} />
				<input type="hidden" name="partner_id" value={item.id} />
				<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
			</form>
		</div>
		<form method="POST" action="?/setName" class="actions-row" style="margin-top: var(--sp-1);">
			<input type="hidden" name="csrf" value={data.csrf} />
			<input type="hidden" name="partner_id" value={item.id} />
			<select name="locale">
				<option value="ka">ქა</option>
				<option value="en">EN</option>
				<option value="ru">РУ</option>
			</select>
			<input type="text" name="name" placeholder="სახელი" required />
			<button class="btn btn-sm btn-outline" type="submit">თარგმანის შენახვა</button>
			<span class="muted">EN: {nameFor(item.id, 'en') || '—'} · РУ: {nameFor(item.id, 'ru') || '—'}</span>
		</form>
	</div>
{:else}
	<p class="muted">ჩანაწერები არ არის</p>
{/each}
