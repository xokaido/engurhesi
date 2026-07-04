<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head>
	<title>პარამეტრები — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>საიტის პარამეტრები</h1>
</div>

{#if form?.saved}<p class="ok-msg" role="status">შენახულია</p>{/if}

<form method="POST" action="?/save" class="panel">
	<input type="hidden" name="csrf" value={data.csrf} />
	{#each data.knownKeys as entry (entry.key)}
		<label class="field">
			<span>{entry.label}</span>
			{#if entry.kind === 'media'}
				<select name={entry.key}>
					<option value="">— არაა —</option>
					{#each data.images as img (img.id)}
						<option value={img.id} selected={data.map[entry.key] === img.id}>{img.filename}</option>
					{/each}
				</select>
			{:else}
				<input type="text" name={entry.key} value={data.map[entry.key] ?? ''} />
			{/if}
		</label>
	{/each}
	<div class="actions-row">
		<button class="btn" type="submit">შენახვა</button>
	</div>
</form>
