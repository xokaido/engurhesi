<script lang="ts">
	import { formatDateTime } from '$lib/i18n';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>შეტყობინებები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>საკონტაქტო შეტყობინებები</h1>
	<nav class="actions-row">
		<a class="btn btn-sm {!data.showHandled ? '' : 'btn-outline'}" href="/admin/inbox">ახალი</a>
		<a class="btn btn-sm {data.showHandled ? '' : 'btn-outline'}" href="/admin/inbox?all=1">ყველა</a>
	</nav>
</div>

{#if form?.saved}<p class="ok-msg" role="status">შენახულია</p>{/if}
{#if form?.deleted}<p class="ok-msg" role="status">წაიშალა</p>{/if}

<p class="muted" style="font-size: 0.85rem;">
	შეტყობინებები ავტომატურად იშლება 12 თვის შემდეგ (მონაცემთა შენახვის პოლიტიკა).
</p>

{#each data.items as item (item.id)}
	<div class="panel" style={item.handled ? 'opacity: 0.65;' : ''}>
		<div class="admin-head" style="margin-bottom: var(--sp-1);">
			<h2 style="font-size: 1rem;">{item.subject}</h2>
			<div class="actions-row">
				<span class="muted">{formatDateTime('ka', item.createdAt)}</span>
				<form method="POST" action="?/markHandled">
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="id" value={item.id} />
					<input type="hidden" name="handled" value={item.handled ? '0' : '1'} />
					<button class="btn btn-sm btn-outline" type="submit">
						{item.handled ? 'დაუმუშავებლად მონიშვნა' : 'დამუშავებულად მონიშვნა'}
					</button>
				</form>
				<form
					method="POST"
					action="?/delete"
					onsubmit={(e) => {
						if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
					}}
				>
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="id" value={item.id} />
					<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
				</form>
			</div>
		</div>
		<p class="muted">
			{item.name} — <a href="mailto:{item.email}">{item.email}</a>
		</p>
		<p style="white-space: pre-wrap;">{item.message}</p>
	</div>
{:else}
	<p class="muted">შეტყობინებები არ არის</p>
{/each}
