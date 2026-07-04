<script lang="ts">
	import { mediaImgUrl } from '$lib/types';

	let { data, form } = $props();

	function itemsFor(albumId: string): string {
		return data.albumItems
			.filter((i) => i.albumId === albumId)
			.map((i) => i.mediaId)
			.join(',');
	}
	function itemCount(albumId: string): number {
		return data.albumItems.filter((i) => i.albumId === albumId).length;
	}
</script>

<svelte:head>
	<title>გალერეა — ადმინი</title>
</svelte:head>

<div class="admin-head">
	<h1>გალერეა და ვიდეო</h1>
</div>

{#if form?.error}<p class="err-msg" role="alert">{form.error}</p>{/if}
{#if form?.albumCreated}<p class="ok-msg" role="status">ალბომი შეიქმნა</p>{/if}
{#if form?.albumItemsSaved}<p class="ok-msg" role="status">ალბომის სურათები შენახულია</p>{/if}
{#if form?.albumTitleSaved}<p class="ok-msg" role="status">სათაური შენახულია</p>{/if}
{#if form?.albumPublished}<p class="ok-msg" role="status">სტატუსი შეიცვალა</p>{/if}
{#if form?.albumDeleted}<p class="ok-msg" role="status">ალბომი წაიშალა</p>{/if}
{#if form?.videoCreated}<p class="ok-msg" role="status">ვიდეო შეიქმნა</p>{/if}
{#if form?.videoPublished}<p class="ok-msg" role="status">სტატუსი შეიცვალა</p>{/if}
{#if form?.videoDeleted}<p class="ok-msg" role="status">ვიდეო წაიშალა</p>{/if}

<div class="panel">
	<h2>ახალი ალბომი</h2>
	<form method="POST" action="?/createAlbum" class="actions-row">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="სათაური (ქართულად)" required style="flex: 1; min-width: 16rem;" />
		<button class="btn" type="submit">შექმნა</button>
	</form>
</div>

{#each data.albums as album (album.id)}
	<div class="panel">
		<div class="admin-head" style="margin-bottom: var(--sp-2);">
			<h2>
				{album.title || album.slug}
				<span class="muted" style="font-weight: normal;">· {itemCount(album.id)} სურათი</span>
			</h2>
			<div class="actions-row">
				<span class="badge {album.status === 'published' ? 'badge-green' : 'badge-amber'}">
					{album.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
				</span>
				<form method="POST" action="?/publishAlbum">
					<input type="hidden" name="csrf" value={data.csrf} />
					<input type="hidden" name="album_id" value={album.id} />
					<input type="hidden" name="publish" value={album.status === 'published' ? '0' : '1'} />
					<button class="btn btn-sm btn-outline" type="submit">
						{album.status === 'published' ? 'გაუქმება' : 'გამოქვეყნება'}
					</button>
				</form>
				{#if data.role === 'admin'}
					<form
						method="POST"
						action="?/deleteAlbum"
						onsubmit={(e) => {
							if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
						}}
					>
						<input type="hidden" name="csrf" value={data.csrf} />
						<input type="hidden" name="album_id" value={album.id} />
						<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
					</form>
				{/if}
			</div>
		</div>

		{#if album.coverMediaId}
			<img
				src={mediaImgUrl(album.coverMediaId, 'thumb')}
				alt=""
				style="height: 4rem; border-radius: 4px;"
			/>
		{/if}

		<details style="margin-top: var(--sp-2);">
			<summary class="muted">სურათების შერჩევა / სათაურის თარგმანი</summary>
			<form method="POST" action="?/setAlbumItems" style="margin-top: var(--sp-2);">
				<input type="hidden" name="csrf" value={data.csrf} />
				<input type="hidden" name="album_id" value={album.id} />
				<div class="pick-grid">
					{#each data.images as img (img.id)}
						<label class="pick-cell">
							<input
								type="checkbox"
								value={img.id}
								checked={itemsFor(album.id).includes(img.id)}
								onchange={(e) => {
									const hidden = (e.currentTarget.closest('form') as HTMLFormElement).querySelector(
										'input[name="media_ids"]'
									) as HTMLInputElement;
									const set = new Set(hidden.value.split(',').filter(Boolean));
									if (e.currentTarget.checked) set.add(img.id);
									else set.delete(img.id);
									hidden.value = [...set].join(',');
								}}
							/>
							<img src={mediaImgUrl(img.id, 'thumb')} alt={img.filename} loading="lazy" />
						</label>
					{/each}
				</div>
				<input type="hidden" name="media_ids" value={itemsFor(album.id)} />
				<button class="btn btn-sm" type="submit" style="margin-top: var(--sp-1);">შენახვა</button>
			</form>
			<form method="POST" action="?/setAlbumTitle" class="actions-row" style="margin-top: var(--sp-2);">
				<input type="hidden" name="csrf" value={data.csrf} />
				<input type="hidden" name="album_id" value={album.id} />
				<select name="locale">
					<option value="ka">ქა</option>
					<option value="en">EN</option>
					<option value="ru">РУ</option>
				</select>
				<input type="text" name="title" placeholder="სათაური" required />
				<button class="btn btn-sm btn-outline" type="submit">შენახვა</button>
			</form>
		</details>
	</div>
{/each}

<div class="panel">
	<h2>ახალი ვიდეო</h2>
	<form method="POST" action="?/createVideo" class="actions-row" style="flex-wrap: wrap;">
		<input type="hidden" name="csrf" value={data.csrf} />
		<input type="text" name="title" placeholder="სათაური (ქართულად)" required style="flex: 1; min-width: 14rem;" />
		<input type="text" name="youtube_id" placeholder="YouTube ID (მაგ. dQw4w9WgXcQ)" />
		<select name="media_id">
			<option value="">— R2 ვიდეო ფაილი —</option>
			{#each data.videoMedia as vm (vm.id)}
				<option value={vm.id}>{vm.filename}</option>
			{/each}
		</select>
		<select name="thumb_media_id">
			<option value="">— მინიატურა —</option>
			{#each data.images as img (img.id)}
				<option value={img.id}>{img.filename}</option>
			{/each}
		</select>
		<button class="btn" type="submit">შექმნა</button>
	</form>
</div>

<table class="admin">
	<thead>
		<tr><th>ვიდეო</th><th>წყარო</th><th>სტატუსი</th><th></th></tr>
	</thead>
	<tbody>
		{#each data.videos as video (video.id)}
			<tr>
				<td>{video.title || video.slug}</td>
				<td class="muted">{video.youtubeId ? `YouTube: ${video.youtubeId}` : 'R2 ფაილი'}</td>
				<td>
					<span class="badge {video.status === 'published' ? 'badge-green' : 'badge-amber'}">
						{video.status === 'published' ? 'გამოქვეყნებული' : 'მონახაზი'}
					</span>
				</td>
				<td>
					<div class="actions-row">
						<form method="POST" action="?/publishVideo">
							<input type="hidden" name="csrf" value={data.csrf} />
							<input type="hidden" name="video_id" value={video.id} />
							<input type="hidden" name="publish" value={video.status === 'published' ? '0' : '1'} />
							<button class="btn btn-sm btn-outline" type="submit">
								{video.status === 'published' ? 'გაუქმება' : 'გამოქვეყნება'}
							</button>
						</form>
						{#if data.role === 'admin'}
							<form
								method="POST"
								action="?/deleteVideo"
								onsubmit={(e) => {
									if (!confirm('ნამდვილად წაიშალოს?')) e.preventDefault();
								}}
							>
								<input type="hidden" name="csrf" value={data.csrf} />
								<input type="hidden" name="video_id" value={video.id} />
								<button class="btn btn-sm btn-danger" type="submit">წაშლა</button>
							</form>
						{/if}
					</div>
				</td>
			</tr>
		{:else}
			<tr><td colspan="4" class="muted">ვიდეოები არ არის</td></tr>
		{/each}
	</tbody>
</table>

<style>
	.pick-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(6rem, 1fr));
		gap: var(--sp-1);
		max-height: 20rem;
		overflow-y: auto;
	}
	.pick-cell {
		position: relative;
		cursor: pointer;
	}
	.pick-cell img {
		width: 100%;
		height: 4.5rem;
		object-fit: cover;
		border-radius: 4px;
		border: 2px solid transparent;
	}
	.pick-cell input {
		position: absolute;
		top: 0.25rem;
		left: 0.25rem;
		z-index: 1;
	}
	.pick-cell input:checked + img {
		border-color: var(--c-primary, #1156a5);
	}
</style>
